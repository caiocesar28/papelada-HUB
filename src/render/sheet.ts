import { PDFDocument, type PDFPage } from 'pdf-lib';
import type { DocumentDef } from '../document';

/** A4 em pt. */
export const A4 = { w: 595.28, h: 841.89 };

/** Quantas vezes o conjunto de páginas sai, descontando as vias que a folha já tem. */
export function folhasNecessarias(def: Pick<DocumentDef, 'copies' | 'viasNaFolha'>): number {
  return Math.max(1, Math.ceil(def.copies / (def.viasNaFolha ?? 1)));
}

/**
 * Monta o PDF final de um documento: escolhe páginas, repete pelas vias e, se perSheet = 2,
 * coloca duas páginas lado a lado em uma A4 deitada.
 */
export async function montarFolhas(def: DocumentDef, preenchido: PDFDocument): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  const indices = def.pages ?? preenchido.getPageIndices();
  const sequencia: number[] = [];
  for (let i = 0; i < folhasNecessarias(def); i++) sequencia.push(...indices);

  if (def.perSheet === 1) {
    const copiadas = await out.copyPages(preenchido, sequencia);
    copiadas.forEach((p) => out.addPage(p));
    return out;
  }

  const embutidas = await out.embedPages(sequencia.map((i) => preenchido.getPage(i)));
  for (let i = 0; i < embutidas.length; i += 2) {
    // Página em pé (A5 retrato): duas lado a lado numa A4 deitada.
    // Página deitada (A5 paisagem): duas empilhadas numa A4 em pé.
    const deitada = embutidas[i].width > embutidas[i].height;
    const folha = out.addPage(deitada ? [A4.w, A4.h] : [A4.h, A4.w]);
    desenharNaCelula(folha, embutidas[i], 0, deitada);
    if (embutidas[i + 1]) desenharNaCelula(folha, embutidas[i + 1], 1, deitada);
  }
  return out;
}

type Embutida = Awaited<ReturnType<PDFDocument['embedPages']>>[number];

/** Célula 0 = esquerda (ou de cima, se empilhado); célula 1 = direita (ou de baixo). */
function desenharNaCelula(folha: PDFPage, pag: Embutida, celula: 0 | 1, empilhar: boolean): void {
  const cw = empilhar ? folha.getWidth() : folha.getWidth() / 2;
  const ch = empilhar ? folha.getHeight() / 2 : folha.getHeight();
  const escala = Math.min(cw / pag.width, ch / pag.height);
  const w = pag.width * escala;
  const h = pag.height * escala;
  const x0 = empilhar ? 0 : celula * cw;
  const y0 = empilhar ? (1 - celula) * ch : 0;
  folha.drawPage(pag, { x: x0 + (cw - w) / 2, y: y0 + (ch - h) / 2, width: w, height: h });
}

/** Junta vários documentos já montados em um único PDF para imprimir de uma vez. */
export async function juntar(docs: PDFDocument[]): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  for (const d of docs) {
    const pags = await out.copyPages(d, d.getPageIndices());
    pags.forEach((p) => out.addPage(p));
  }
  return out;
}
