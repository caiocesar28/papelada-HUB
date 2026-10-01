import { PDFDocument, degrees, type PDFPage } from 'pdf-lib';
import type { DocumentDef } from '../document';

/** A4 em pt. */
export const A4 = { w: 595.28, h: 841.89 };

/** Quantas vezes o conjunto de páginas sai, descontando as vias que a folha já tem. */
export function folhasNecessarias(def: Pick<DocumentDef, 'copies' | 'viasNaFolha'>): number {
  return Math.max(1, Math.ceil(def.copies / (def.viasNaFolha ?? 1)));
}

/** Páginas do PDF preenchido na ordem de impressão (com as repetições das vias). */
function sequencia(def: DocumentDef, preenchido: PDFDocument): number[] {
  const indices = def.pages ?? preenchido.getPageIndices();
  const seq: number[] = [];
  for (let i = 0; i < folhasNecessarias(def); i++) seq.push(...indices);
  return seq;
}

type Recorte = { x: number; y: number; width: number; height: number };

/** Uma meia folha a imprimir: uma página (ou um recorte dela) que ocupa metade de uma A4. */
export interface Meia {
  pdf: PDFDocument;
  pagina: number;
  recorte?: Recorte;
}

/**
 * Meias folhas de um documento, ou null se ele ocupa folhas inteiras.
 * - perSheet 2: cada página do formulário é meia folha (A5);
 * - meiaFolha: o documento usa só uma região de uma A4 (p.ex. metade dos cartões de retorno).
 */
export function meiasDoDocumento(def: DocumentDef, preenchido: PDFDocument): Meia[] | null {
  if (def.perSheet === 2) return sequencia(def, preenchido).map((pagina) => ({ pdf: preenchido, pagina }));
  if (def.meiaFolha) {
    const { page, ...recorte } = def.meiaFolha;
    return Array.from({ length: folhasNecessarias(def) }, () => ({ pdf: preenchido, pagina: page, recorte }));
  }
  return null;
}

/**
 * Monta o PDF de UM documento (pré-visualização e impressão sem juntar): escolhe páginas,
 * repete pelas vias e, se perSheet = 2, põe duas páginas numa A4.
 */
export async function montarFolhas(def: DocumentDef, preenchido: PDFDocument): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  if (def.perSheet === 1) {
    const copiadas = await out.copyPages(preenchido, sequencia(def, preenchido));
    copiadas.forEach((p) => out.addPage(p));
    return out;
  }
  await empacotarMeias(out, meiasDoDocumento(def, preenchido)!);
  return out;
}

type Embutida = Awaited<ReturnType<PDFDocument['embedPage']>>;

/**
 * Põe as meias folhas, duas a duas, em folhas A4 (na ordem dada).
 * - duas em pé (A5 retrato): lado a lado numa A4 deitada;
 * - qualquer outra combinação: empilhadas numa A4 em pé, girando 90° as que estão em pé.
 */
export async function empacotarMeias(out: PDFDocument, meias: Meia[]): Promise<void> {
  const embutidas: Embutida[] = [];
  for (const m of meias) {
    const pag = m.pdf.getPage(m.pagina);
    const r = m.recorte;
    embutidas.push(
      await out.embedPage(pag, r ? { left: r.x, bottom: r.y, right: r.x + r.width, top: r.y + r.height } : undefined),
    );
  }
  const emPe = (e: Embutida) => e.height >= e.width;
  for (let i = 0; i < embutidas.length; i += 2) {
    const a = embutidas[i];
    const b = embutidas[i + 1];
    const ladoALado = emPe(a) && (!b || emPe(b));
    const folha = out.addPage(ladoALado ? [A4.h, A4.w] : [A4.w, A4.h]);
    desenharNaCelula(folha, a, 0, !ladoALado);
    if (b) desenharNaCelula(folha, b, 1, !ladoALado);
  }
}

/**
 * Célula 0 = esquerda (ou de cima, se empilhado); célula 1 = direita (ou de baixo).
 * Numa célula deitada (empilhado), uma página em pé é girada 90° para aproveitar o espaço.
 */
function desenharNaCelula(folha: PDFPage, pag: Embutida, celula: 0 | 1, empilhar: boolean): void {
  const cw = empilhar ? folha.getWidth() : folha.getWidth() / 2;
  const ch = empilhar ? folha.getHeight() / 2 : folha.getHeight();
  const x0 = empilhar ? 0 : celula * cw;
  const y0 = empilhar ? (1 - celula) * ch : 0;
  const girar = empilhar && pag.height > pag.width;
  // dimensões já como ficam na folha
  const pw = girar ? pag.height : pag.width;
  const ph = girar ? pag.width : pag.height;
  const escala = Math.min(cw / pw, ch / ph);
  const w = pw * escala;
  const h = ph * escala;
  const x = x0 + (cw - w) / 2;
  const y = y0 + (ch - h) / 2;
  if (!girar) {
    folha.drawPage(pag, { x, y, width: w, height: h });
    return;
  }
  // Rotação de 90° anti-horária em torno de (x, y): a largura da página sobe e a altura vai
  // para a esquerda; por isso o ponto de origem fica no canto inferior direito da área.
  folha.drawPage(pag, {
    x: x + w,
    y,
    width: pag.width * escala,
    height: pag.height * escala,
    rotate: degrees(90),
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
