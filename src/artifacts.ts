// Wire documents remain available verbatim. This is an admission layer for the
// viewer, not a second semantic validator for AIR.
export type Raw = Record<string, any>;
export interface Documents {
  air: Raw;
  cfg: Raw;
  sp?: Raw;
  links?: Raw;
  dependencies?: Raw;
  sources: Record<string, string>;
  title?: string;
  evidence?: Raw;
  files: Record<string, string>;
}
export const MAX_BYTES = 128 * 1024 * 1024;
export function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function parseJson(text: string, name: string): Raw {
  try {
    const result = JSON.parse(text);
    assert(result && typeof result === 'object' && !Array.isArray(result), 'Objeto JSON esperado');
    return result;
  } catch (e) {
    throw new Error(`${name}: JSON inválido. ${e instanceof Error ? e.message : ''}`);
  }
}
export async function sha256(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function decodeBytes(bytes: Uint8Array): Promise<string> {
  assert(bytes.byteLength <= MAX_BYTES, 'Arquivo excede o limite local de 128 MiB.');
  if (bytes[0] !== 31 || bytes[1] !== 139)
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const reader = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      assert(size <= MAX_BYTES, 'Conteúdo descomprimido excede 128 MiB.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(all);
}
export async function admitFiles(files: Record<string, string>): Promise<Documents> {
  const found: Record<string, { raw: Raw; text: string }> = {};
  let sources: Record<string, string> = {};
  let title: string | undefined, evidence: Raw | undefined;
  let expanded = files;
  const entries = Object.entries(files);
  if (entries.length === 1 && !/\.(cbl|cob|cpy)$/i.test(entries[0][0])) {
    const bundle = parseJson(entries[0][1], entries[0][0]);
    if (bundle.schema === 'cobol-explorer-bundle') {
      assert(bundle.version === '1.0.0', 'Versão do pacote não suportada.');
      assert(
        bundle.artifacts &&
          typeof bundle.artifacts === 'object' &&
          !Array.isArray(bundle.artifacts),
        'Pacote sem artifacts.',
      );
      expanded = bundle.artifacts;
      sources = bundle.sources ?? {};
      title = bundle.title;
      evidence = bundle.evidence;
      assert(
        Object.values(sources).every((v) => typeof v === 'string'),
        'Fontes do pacote devem ser textos.',
      );
    }
  }
  for (const [name, text] of Object.entries(expanded)) {
    assert(typeof text === 'string', `${name}: artefato deve preservar os bytes UTF-8 como texto.`);
    if (/\.(cbl|cob|cpy)$/i.test(name)) {
      assert(!(name in sources), `Fonte duplicada: ${name}`);
      sources = { ...sources, [name]: text };
      continue;
    }
    const d = parseJson(text, name);
    const type =
      d.binding === 'analysis-ir-json'
        ? 'air'
        : d.schema === 'analysis-cfg-json'
          ? 'cfg'
          : d.schema === 'cobol-semantic-product' || d.schema === 'cobol-semantic-compilation'
            ? 'sp'
            : d.schema === 'analysis-dependency-result'
              ? 'dependencies'
              : d.schema === 'cobol-explorer-links'
                ? 'links'
                : null;
    assert(type, `${name}: contrato não suportado (${d.schema ?? d.binding ?? 'sem schema'}).`);
    assert(!found[type], `Mais de um artefato ${type}. Abra uma publicação por vez.`);
    found[type] = { raw: d, text };
  }
  assert(
    found.air && found.cfg,
    'Selecione AIR e CFG da mesma publicação, ou um pacote .json.gz de exemplo.',
  );
  const air = found.air.raw,
    cfg = found.cfg.raw;
  assert(
    air.bindingVersion === '1.0.0' && air.airVersion === '2.0.0',
    'Binding AIR não suportado (esperado 1.0.0 / AIR 2.0.0).',
  );
  assert(
    ['1.0.0', '2.0.0', '3.0.0'].includes(cfg.schemaVersion) && cfg.airVersion === '2.0.0',
    'Versão de CFG não suportada.',
  );
  assert(
    cfg.buildStatus === 'CFG_BUILT' && ['KNOWN_SUBSET', 'STRICT'].includes(cfg.projectionPolicy),
    'CFG sem projeção suportada.',
  );
  assert(
    air.publication?.id?.localId === cfg.publication?.localId,
    'AIR e CFG pertencem a publicações diferentes.',
  );
  assert(
    Array.isArray(air.publication?.units) &&
      Array.isArray(cfg.nodes) &&
      Array.isArray(cfg.transitions),
    'Inventário AIR/CFG inválido.',
  );
  const sp = found.sp?.raw,
    links = found.links?.raw,
    dep = found.dependencies?.raw;
  if (sp) {
    assert(
      (sp.schema === 'cobol-semantic-compilation' && sp.contractVersion === '1.0.0') ||
        (sp.schema === 'cobol-semantic-product' &&
          /^2\.([0-9]+)\.0$/.test(sp.contractVersion) &&
          Number(sp.contractVersion.split('.')[1]) <= 47),
      'Versão SP não suportada.',
    );
  }
  if (links) {
    assert(
      links.version === '1.0.0' && links.publication?.localId === cfg.publication.localId,
      'Links incompatíveis com a publicação.',
    );
    assert(found.sp, 'Os links exigem o Semantic Product original.');
    const [spHash, airHash] = await Promise.all([sha256(found.sp.text), sha256(found.air.text)]);
    assert(
      links.spSha256 === spHash && links.airSha256 === airHash,
      'Hash de SP/AIR difere do registrado nos links. Não é seguro correlacionar estes arquivos.',
    );
    assert(
      Array.isArray(links.statements) && Array.isArray(links.entries),
      'Inventário de links inválido.',
    );
  }
  if (dep) {
    assert(
      [
        '1.0.0',
        '1.1.0',
        '1.2.0',
        '2.0.0',
        '2.1.0',
        '2.2.0',
        '2.3.0',
        '2.4.0',
        '2.5.0',
        '2.6.0',
      ].includes(dep.version),
      'Versão de dependencies não suportada.',
    );
    assert(
      dep.publication?.localId === cfg.publication.localId,
      'Dependencies pertencem a outra publicação.',
    );
    assert(Array.isArray(dep.sites), 'Dependencies sem inventário de sites.');
    if (dep.fileDependencies) {
      assert(
        Array.isArray(dep.fileDependencies.sites) &&
          Array.isArray(dep.fileDependencies.declarations),
        'Inventário FILE inválido.',
      );
      assert(
        ['file-literal@1', 'file-values@1', 'file-values-context@1'].includes(
          dep.fileDependencies.valuesProfile,
        ),
        'Perfil de valores FILE não suportado.',
      );
    }
  }
  return { air, cfg, sp, links, dependencies: dep, sources, title, evidence, files: expanded };
}
