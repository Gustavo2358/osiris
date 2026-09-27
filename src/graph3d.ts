import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import type { NodeObject, LinkObject } from '3d-force-graph';
import type { GraphNode, GraphEdge } from './model';
export { CARD_WIDTH, CARD_HEIGHT } from './graph-dimensions';

export type Point3D = { x: number; y: number; z: number };
export type GraphViewport = { position: Point3D; target: Point3D; up: Point3D };
export type SceneNode = NodeObject &
  Point3D & {
    id: string;
    node: GraphNode;
    category: string;
    candidates: number;
    paragraph: string;
  };
export type SceneLink = LinkObject<SceneNode> & { id: string; edge: GraphEdge; points: Point3D[] };
export const DETAIL_LIMIT = 128;
export const colors: Record<string, string> = {
  FLUXO: '#cbd6e5',
  CHAMADA: '#a7a1fa',
  ARQUIVO: '#6ddac3',
  DECISÃO: '#eec27b',
  ENTRADA: '#87bfff',
};
export function category(node: GraphNode) {
  return node.fileSiteIds.length
    ? 'ARQUIVO'
    : node.siteIds.length
      ? 'CHAMADA'
      : node.kind === 'BRANCH'
        ? 'DECISÃO'
        : node.kind === 'ENTRY'
          ? 'ENTRADA'
          : 'FLUXO';
}
export function edgeColor(edge: GraphEdge, witness?: Set<string>) {
  return witness?.has(edge.id)
    ? '#c4b5fd'
    : edge.kind === 'BRANCH_TRUE'
      ? '#6ee7b7'
      : edge.kind === 'BRANCH_FALSE'
        ? '#ffd080'
        : '#a5b8d5';
}
export function edgeDescription(edge: GraphEdge) {
  const names: Record<string, string> = {
    BRANCH_TRUE: 'Sim',
    BRANCH_FALSE: 'Não',
    INVOKE_NORMAL: 'Retorno da chamada',
    RETURN: 'Retorno',
    OPAQUE_JUMP: 'Continuação conhecida',
    ENTRY: 'Entrada',
    JUMP: 'Continuação',
  };
  return names[edge.kind] ?? edge.kind;
}
function lines(context: CanvasRenderingContext2D, text: string, width: number, max: number) {
  const words = text.split(/\s+/);
  const result: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > width && line) {
      result.push(line);
      line = word;
    } else line = next;
  }
  if (line) result.push(line);
  if (result.length > max) result[max - 1] = result[max - 1].slice(0, -2) + '…';
  return result.slice(0, max);
}
// Textures exist only for nearby cards. Distant cards share one texture per category.
export function cardTexture(item: SceneNode | string, selected = false) {
  const detailed = typeof item !== 'string';
  const canvas = document.createElement('canvas');
  canvas.width = detailed ? 540 : 90;
  canvas.height = detailed ? 264 : 44;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(canvas.width / 540, canvas.height / 264);
  const kind = detailed ? item.category : item;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = selected ? '#818cf8' : colors[kind];
  ctx.lineWidth = selected ? 14 : 6;
  ctx.beginPath();
  ctx.roundRect(8, 8, 524, 248, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors[kind];
  ctx.beginPath();
  ctx.roundRect(20, 22, 7, 220, 3);
  ctx.fill();
  if (detailed) {
    ctx.fillStyle = '#42526b';
    ctx.font = '600 18px system-ui, sans-serif';
    const meta = kind === 'FLUXO' ? item.paragraph || kind : kind;
    ctx.fillText(meta.length > 32 ? meta.slice(0, 31) + '…' : meta, 42, 45, 375);
    ctx.textAlign = 'right';
    ctx.fillText(item.node.location ? `L${item.node.location.startLine}` : '', 508, 45);
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#dde4ef';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 61);
    ctx.lineTo(508, 61);
    ctx.stroke();
    ctx.fillStyle = '#17263e';
    ctx.font = '600 23px Consolas, monospace';
    lines(ctx, item.node.title, 462, 4).forEach((line, i) =>
      ctx.fillText(line, 42, 95 + i * 28, 462),
    );
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillStyle = '#536177';
    ctx.fillText(
      item.node.contexts > 1 ? `Contexto ${item.node.contextIndex}/${item.node.contexts}` : 'COBOL',
      42,
      232,
    );
    ctx.textAlign = 'right';
    ctx.fillText(
      item.node.open
        ? 'controle aberto'
        : item.node.fileSiteIds.length
          ? `${item.candidates} valores`
          : item.node.siteIds.length
            ? `${item.candidates} candidatos`
            : '',
      508,
      232,
    );
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}
