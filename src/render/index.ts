import { PDFDocument } from 'pdf-lib';
import type { DocumentDef } from '../document';
import { valores, type Contexto } from '../patient';
import { preencher, type CampoVazio, type OpcoesPreenchimento } from './fill';
import { empacotarMeias, juntar, meiasDoDocumento, montarFolhas, type Meia } from './sheet';

export type { CampoVazio } from './fill';
export { juntar } from './sheet';

export interface DocumentoGerado {
  def: DocumentDef;
  /** Montado só com este documento (pré-visualização). */
  pdf: PDFDocument;
  /** Formulário preenchido, antes de montar as folhas (para juntar meias folhas no lote). */
  preenchido: PDFDocument;
  vazios: CampoVazio[];
}

/** Lê o PDF original servido em public/. Só GET do próprio site: nenhum dado sai. */
export async function carregarFormulario(def: DocumentDef): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.BASE_URL}${def.form}`);
  } catch {
    throw new Error(`não consegui baixar o formulário ${def.form}. O servidor do app está rodando? Recarregue a página.`);
  }
  if (!res.ok) throw new Error(`não consegui carregar ${def.form} (HTTP ${res.status})`);
  return res.arrayBuffer();
}

export async function gerarDocumento(
  def: DocumentDef,
  ctx: Contexto,
  formBytes: Uint8Array | ArrayBuffer,
  opts: OpcoesPreenchimento = {},
): Promise<DocumentoGerado> {
  const { pdf, vazios } = await preencher(def, formBytes, valoresDoDocumento(def, ctx), opts);
  return { def, pdf: await montarFolhas(def, pdf), preenchido: pdf, vazios };
}

/** valores(ctx) + os derivados do documento ('doc.*'). */
export function valoresDoDocumento(def: DocumentDef, ctx: Contexto): Record<string, string> {
  const v = valores(ctx);
  return def.calcular ? { ...v, ...def.calcular(v, ctx) } : v;
}

export interface OpcoesLote {
  /** Meias folhas de documentos diferentes dividem a mesma A4 (economiza papel). */
  juntarMeias?: boolean;
}

/**
 * Todos os documentos marcados em um único PDF, na ordem dada. Com `juntarMeias`, as meias
 * folhas de todos os documentos são empacotadas juntas, no lugar do primeiro documento de meia
 * folha.
 */
export async function gerarLote(gerados: DocumentoGerado[], opts: OpcoesLote = {}): Promise<Uint8Array> {
  if (!opts.juntarMeias) return (await juntar(gerados.map((g) => g.pdf))).save();

  const out = await PDFDocument.create();
  const meias: Meia[] = [];
  let posicao = -1;
  for (const g of gerados) {
    const m = meiasDoDocumento(g.def, g.preenchido);
    if (m) {
      if (posicao < 0) posicao = out.getPageCount();
      meias.push(...m);
      continue;
    }
    const pags = await out.copyPages(g.pdf, g.pdf.getPageIndices());
    pags.forEach((p) => out.addPage(p));
  }
  if (meias.length) {
    const folhas = await PDFDocument.create();
    await empacotarMeias(folhas, meias);
    const pags = await out.copyPages(folhas, folhas.getPageIndices());
    pags.forEach((p, i) => out.insertPage(posicao + i, p));
  }
  return out.save();
}

/** Quantas folhas o lote usa (para mostrar a economia na tela). */
export function contarFolhas(gerados: DocumentoGerado[], juntarMeias: boolean): number {
  if (!juntarMeias) return gerados.reduce((n, g) => n + g.pdf.getPageCount(), 0);
  let inteiras = 0;
  let meias = 0;
  for (const g of gerados) {
    const m = meiasDoDocumento(g.def, g.preenchido);
    if (m) meias += m.length;
    else inteiras += g.pdf.getPageCount();
  }
  return inteiras + Math.ceil(meias / 2);
}
