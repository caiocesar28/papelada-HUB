import type { PDFDocument } from 'pdf-lib';
import type { DocumentDef } from '../document';
import { valores, type Contexto } from '../patient';
import { preencher, type CampoVazio, type OpcoesPreenchimento } from './fill';
import { juntar, montarFolhas } from './sheet';

export type { CampoVazio } from './fill';
export { juntar } from './sheet';

export interface DocumentoGerado {
  def: DocumentDef;
  pdf: PDFDocument;
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
  return { def, pdf: await montarFolhas(def, pdf), vazios };
}

/** valores(ctx) + os derivados do documento ('doc.*'). */
export function valoresDoDocumento(def: DocumentDef, ctx: Contexto): Record<string, string> {
  const v = valores(ctx);
  return def.calcular ? { ...v, ...def.calcular(v, ctx) } : v;
}

/** Todos os documentos marcados em um único PDF, na ordem dada. */
export async function gerarLote(gerados: DocumentoGerado[]): Promise<Uint8Array> {
  const pdf = await juntar(gerados.map((g) => g.pdf));
  return pdf.save();
}
