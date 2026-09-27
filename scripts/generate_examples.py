#!/usr/bin/env python3
"""Real producer executions. No source parsing, inferred edges or rewritten products."""
import pathlib,subprocess,json,hashlib,gzip,datetime,shutil,sys
ROOT=pathlib.Path(__file__).resolve().parents[1];WS=ROOT.parent
runtime=ROOT/'.cache/runtime';cp=(runtime/'classpath.txt').read_text();build=json.loads((runtime/'build.json').read_text())
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'); run=ROOT/'.cache/runs'/stamp;run.mkdir(parents=True)
large=ROOT/'fixtures/LARGE-ROUTER.cbl'
lines=['IDENTIFICATION DIVISION.','PROGRAM-ID. LARGE-ROUTER.','DATA DIVISION.','WORKING-STORAGE SECTION.','01 FLAG PIC X.','01 WS-PGM PIC X(8).','PROCEDURE DIVISION.']
for n in range(100):
 lines.extend([f'P-{n:03}.',f"MOVE 'SRV{n:03}' TO WS-PGM.",f"IF FLAG = 'Y'",f'    GO TO P-{min(n+2,100):03}', 'END-IF.','CALL WS-PGM.',f'GO TO P-{n+1:03}.'])
lines.extend(['P-100.','GOBACK.']);large.write_text('\n'.join(f'{i+1:06} '+line for i,line in enumerate(lines))+'\n')
goto=ROOT/'fixtures/IF-GOTO.cbl';goto.write_text('\n'.join('       '+line for line in (WS/'proleap-poc/src/test/resources/cobol/goto/if-jump.cbl').read_text().splitlines())+'\n')
cases=[('order-router','Roteamento de pedidos','Branches, PERFORM e chamadas','fixed',ROOT/'fixtures/ORDER-ROUTER.cbl'),('goto','Desvio de controle','IF, GO TO e CALL dinâmico','fixed (fixture adaptada)',goto),('perform','PERFORM repetido','Mesmo paragraph, contextos distintos','fixed',WS/'proleap-poc/src/test/resources/partial-program/perform-repeated.cbl'),('cics','Serviços CICS','LINK dinâmico, literal e XCTL','fixed',ROOT/'fixtures/CICS-ROUTER.cbl'),('large','100 rotas de serviço','Escala: branches e 100 call sites','fixed com sequência',large),('multi-call','Chamadas em sequência','CALLs literais e dinâmicos','fixed',WS/'proleap-poc/src/test/resources/multi-call/fixture-1.cbl'),('nested','Programas aninhados','Units e identidades locais distintas','fixed',ROOT/'fixtures/NESTED.cbl')]
cases.append(('copy','Statements em COPY','Provenance e fonte em copybook','fixed com sequência',ROOT/'fixtures/COPY-DEMO.cbl'))
cycle=ROOT/'fixtures/GOTO-CYCLE.cbl';cycle.write_text('\n'.join('       '+line for line in (WS/'proleap-poc/src/test/resources/cobol/goto/cycle.cbl').read_text().splitlines())+'\n')
cases.append(('cycle','Ciclo com GO TO','Retorno ao paragraph e CALL dinâmico','fixed (fixture adaptada)',cycle))
cases.append(('until','PERFORM UNTIL','TEST AFTER e laço com saída condicional','fixed',WS/'proleap-poc/src/test/resources/cobol/perform-family/until-1.cbl'))
cases.append(('minimal','Entrada e GOBACK','Contrato CFG v1, fluxo mínimo','fixed',WS/'artefatos-e2e/checkpoint-3-e2e/input/semantic-product-entry-goback.cbl'))
cases.append(('partial','Operação parcial','CALL e DISPLAY preservados no CFG v3','fixed',WS/'proleap-poc/src/test/resources/partial-program/p1.cbl'))
selected=sys.argv[1:];manifest=[];reports=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def execute(case,phase,args,cwd):
 r=subprocess.run(args,cwd=cwd,capture_output=True,text=True)
 (case/(phase+'.log')).write_text(r.stdout+r.stderr)
 rec={'phase':phase,'command':args,'cwd':str(cwd),'exitCode':r.returncode};reports.append(rec)
 if r.returncode:raise RuntimeError(phase+': '+r.stderr[-2000:])
for name,title,description,fmt,source in cases:
 if selected and name not in selected:continue
 dest=run/name;dest.mkdir(); front=dest/'sp';front.mkdir()
 try:
  execute(dest,'frontend',['java','-cp',cp,'io.github.gustavo2358.cobolexplorer.ExplorerMain','--source',str(source),'--output',str(front),'--copybooks',str(source.parent),'--entry-storage-state','initial','--cics-entry-mode','new-logical-level','--logical-text','disabled','--storage-profile','ibm-enterprise-6.4-fixed-display-1047@1'],WS/'proleap-poc')
  sp=front/('cobol-semantic-compilation.json' if name=='nested' else 'cobol-semantic-product.json')
  execute(dest,'lower',['java','-cp',cp,'ExportLinks',str(sp),str(dest/'air.json'),str(dest/'links.json'),str(dest/'source-evidence.json')],ROOT)
  execute(dest,'cfg',['java','-cp',cp,'io.github.gustavo2358.analysis.cfg.launcher.AnalysisCfg',str(dest/'air.json'),str(dest/'cfg.json')],ROOT)
  execute(dest,'dependencies',['java','-cp',cp,'io.github.gustavo2358.analysis.launcher.AnalysisDependencies',str(dest/'air.json'),str(dest/'dependencies.json'),'--source-evidence',str(dest/'source-evidence.json')],ROOT)
  files={'sp.json':sp,**{f:dest/f for f in ['air.json','links.json','cfg.json','dependencies.json']}}
  artifacts={k:p.read_text() for k,p in files.items()}
  c=json.loads(artifacts['cfg.json']);d=json.loads(artifacts['dependencies.json'])
  bundle={'schema':'cobol-explorer-bundle','version':'1.0.0','title':title,'artifacts':artifacts,'sources':{source.name:source.read_text(),'<preprocessed>':(front/'preprocessed.cbl').read_text(),**({p.name:p.read_text() for p in source.parent.glob('*.cpy')} if name=='copy' else {})},'evidence':{'generatedAt':stamp,'producerBuild':build,'sourcePath':str(source.relative_to(WS)),'sourceFormat':fmt,'sourceSha256':sha(source.read_bytes()),'artifactSha256':{k:sha(p.read_bytes()) for k,p in files.items()}}}
  encoded=json.dumps(bundle,ensure_ascii=False,separators=(',',':')).encode();out=ROOT/'public/examples'/f'{name}.json.gz';out.write_bytes(gzip.compress(encoded,mtime=0))
  row={'id':name,'title':title,'description':description,'format':fmt,'url':f'examples/{name}.json.gz','nodes':len(c['nodes']),'edges':len(c['transitions']),'sites':len(d['sites']),'bytes':len(encoded),'sha256':sha(out.read_bytes())};manifest.append(row);print('OK',row,flush=True)
 except Exception as e:
  print('FAILED',name,e,flush=True);reports.append({'case':name,'error':str(e)})
index=ROOT/'public/examples/index.json'
if selected and index.exists():manifest=[r for r in json.loads(index.read_text()) if r['id'] not in selected]+manifest
index.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
(ROOT/'evidence'/('generation-'+stamp+'.json')).write_text(json.dumps({'run':str(run.relative_to(ROOT)),'build':build,'executions':reports,'examples':manifest},indent=2)+'\n')
if any('error' in r for r in reports):sys.exit(1)
