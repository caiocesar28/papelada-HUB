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
    const folha = out.addPage([A4.h, A4.w]);
    desenharNaCelula(folha, embutidas[i], 0);
    if (embutidas[i + 1]) desenharNaCelula(folha, embutidas[i + 1], 1);
  }
  return out;
}

type Embutida = Awaited<ReturnType<PDFDocument['embedPages']>>[number];

function desenharNaCelula(folha: PDFPage, pag: Embutida, celula: 0 | 1): void {
  const cw = folha.getWidth() / 2;
  const ch = folha.getHeight();
  const escala = Math.min(cw / pag.width, ch / pag.height);
  const w = pag.width * escala;
  const h = pag.height * escala;
  folha.drawPage(pag, {
    x: celula * cw + (cw - w) / 2,
    y: (ch - h) / 2,
    width: w,
    height: h,
  });
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
