import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFDict,
  PDFName,
  PDFOptionList,
  PDFStream,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFForm,
  type PDFPage,
} from 'pdf-lib';
import type { CampoAcroform, CampoDef, CampoOverlay, DocumentDef } from '../document';
import { isAcroform } from '../document';
import { completarComTracos, paraWinAnsi } from './text';

export interface CampoVazio {
  key: string;
  label: string;
}

export interface Preenchido {
  pdf: PDFDocument;
  vazios: CampoVazio[];
}

export interface OpcoesPreenchimento {
  /** Pinta de amarelo os campos que ficaram vazios (só para a pré-visualização). */
  destacarVazios?: boolean;
}

const DESTAQUE = rgb(1, 0.85, 0.1);
const TAMANHO_PADRAO = 10;
const TAMANHO_MINIMO = 6;

/**
 * Preenche UMA cópia do formulário. Não lida com vias, nem com folhas (ver sheet.ts).
 */
export async function preencher(
  def: DocumentDef,
  formBytes: Uint8Array | ArrayBuffer,
  vals: Record<string, string>,
  opts: OpcoesPreenchimento = {},
): Promise<Preenchido> {
  const pdf = await PDFDocument.load(formBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const vazios = new Map<string, CampoVazio>();
  const destaques: Array<{ page: PDFPage; rect: Retangulo }> = [];
  /** Caixas a marcar com "X" depois do flatten (ver preencherAcro). */
  const marcas: Array<{ page: PDFPage; rect: Retangulo }> = [];

  const acro = def.fields.filter(isAcroform);
  const over = def.fields.filter((c): c is CampoOverlay => !isAcroform(c));

  if (pdf.getForm().getFields().length > 0) {
    const form = pdf.getForm();
    // Alguns PDFs do espelho vêm com valores salvos (o receituário SES traz uma receita real).
    // Sempre partir de tudo limpo.
    limparTudo(form);
    removerFundoDosCampos(form);
    for (const c of acro) {
      if (!ativo(vals, c)) continue;
      const v = valor(vals, c);
      if (estaVazio(c, v)) {
        vazios.set(c.key, { key: c.key, label: c.label ?? c.key });
        if (opts.destacarVazios) destaques.push(...retangulosDoCampo(pdf, form, c.name));
      }
      if (c.checkbox) {
        // Não usamos o "check" do AcroForm: a aparência marcada depende da fonte ZapfDingbats,
        // que não vai embutida e some em alguns visualizadores/impressoras. Desenhamos um X.
        if (marcado(c, v)) marcas.push(...retangulosDoCampo(pdf, form, c.name));
        continue;
      }
      preencherAcro(form, c, v, font);
    }
    form.updateFieldAppearances(font);
    aparenciaDoEstadoAtual(form);
    try {
      form.flatten({ updateFieldAppearances: false });
    } catch (e) {
      // Widgets malformados impedem o flatten; os valores continuam visíveis como campos.
      console.warn(`[${def.id}] flatten falhou, campos mantidos editáveis`, e);
    }
    // Depois do flatten, para ficar por cima da aparência do campo.
    for (const d of destaques) d.page.drawRectangle({ ...d.rect, color: DESTAQUE, opacity: 0.45 });
    for (const m of marcas) desenharX(m.page, m.rect, font);
  } else if (acro.length > 0) {
    throw new Error(`[${def.id}] o PDF não tem AcroForm, mas há campos com 'name'`);
  }

  const pages = pdf.getPages();
  for (const m of def.mascaras ?? []) {
    const page = pages[m.page];
    if (!page) throw new Error(`[${def.id}] página ${m.page} não existe (máscara)`);
    page.drawRectangle({ x: m.x, y: m.y, width: m.width, height: m.height, color: rgb(1, 1, 1) });
  }
  for (const c of over) {
    const page = pages[c.page];
    if (!page) throw new Error(`[${def.id}] página ${c.page} não existe (campo ${c.key})`);
    if (!ativo(vals, c)) continue;
    const v = valor(vals, c);
    if (estaVazio(c, v)) {
      vazios.set(c.key, { key: c.key, label: c.label ?? c.key });
      if (opts.destacarVazios) destacarOverlay(page, c);
      continue;
    }
    desenharOverlay(page, c, v, font);
  }

  return { pdf, vazios: [...vazios.values()] };
}

function valor(vals: Record<string, string>, c: CampoDef): string {
  return ler(vals, c.key);
}

function ler(vals: Record<string, string>, key: string): string {
  const v = vals[key];
  if (v === undefined) {
    // extraInputs não respondidos simplesmente não existem no mapa.
    if (key.startsWith('extra.')) return '';
    throw new Error(`chave desconhecida: '${key}' (ver valores() em src/patient.ts e calcular())`);
  }
  return v;
}

function ativo(vals: Record<string, string>, c: CampoDef): boolean {
  return c.se === undefined || ler(vals, c.se) !== '';
}

function estaVazio(c: CampoDef, v: string): boolean {
  return !c.checkbox && !c.opcional && v === '';
}

function marcado(c: CampoDef, v: string): boolean {
  return c.marcarSe !== undefined ? v === c.marcarSe : v !== '';
}

function limparTudo(form: PDFForm): void {
  for (const f of form.getFields()) {
    if (f instanceof PDFTextField) f.setText('');
    else if (f instanceof PDFCheckBox) f.uncheck();
    else if (f instanceof PDFRadioGroup || f instanceof PDFDropdown || f instanceof PDFOptionList) f.clear();
  }
}

/** "X" centrado na caixa, do tamanho dela. */
function desenharX(page: PDFPage, r: Retangulo, font: PDFFont): void {
  const size = Math.max(6, Math.min(r.width, r.height) * 1.25);
  const w = font.widthOfTextAtSize('X', size);
  const h = font.heightAtSize(size, { descender: false });
  page.drawText('X', { x: r.x + (r.width - w) / 2, y: r.y + (r.height - h) / 2, size, font });
}

function preencherAcro(form: PDFForm, c: CampoAcroform, v: string, font: PDFFont): void {
  const tf = form.getTextField(c.name);
  const largura = tf.acroField.getWidgets()[0]?.getRectangle().width;
  // margem: borda/padding do campo + folga para o pdf-lib não quebrar a linha tracejada
  const texto = completarComTracos(paraWinAnsi(v, font), largura && largura - 8, font, c.size ?? TAMANHO_PADRAO);
  if (texto.includes('\n')) tf.enableMultiline();
  const max = tf.getMaxLength();
  tf.setText(max !== undefined ? texto.slice(0, max) : texto);
  if (c.size !== undefined) tf.setFontSize(c.size);
}

function desenharOverlay(page: PDFPage, c: CampoOverlay, v: string, font: PDFFont): void {
  const size0 = c.size ?? TAMANHO_PADRAO;
  const texto = c.checkbox
    ? marcado(c, v)
      ? 'X'
      : ''
    : completarComTracos(paraWinAnsi(v, font), c.maxWidth, font, size0);
  if (!texto) return;
  let size = size0;
  let final = texto;
  if (c.linhas && c.maxWidth) {
    // Diminui a fonte até caber no número de linhas; no mínimo, corta com reticências.
    let linhas = quebrarLinhas(texto, c.maxWidth, font, size);
    while (linhas.length > c.linhas && size > TAMANHO_MINIMO) {
      size = Math.max(TAMANHO_MINIMO, size - 0.5);
      linhas = quebrarLinhas(texto, c.maxWidth, font, size);
    }
    if (linhas.length > c.linhas) linhas = [...linhas.slice(0, c.linhas - 1), `${linhas[c.linhas - 1]}…`];
    final = linhas.join('\n');
  } else if (c.maxWidth) {
    const largura = Math.max(...texto.split('\n').map((l) => font.widthOfTextAtSize(l, size)));
    if (largura > c.maxWidth) size = Math.max(TAMANHO_MINIMO, (size * c.maxWidth) / largura);
  }
  page.drawText(final, {
    x: c.x,
    y: c.y,
    size,
    font,
    lineHeight: c.lineHeight ?? size * 1.2,
    rotate: c.rotate ? degrees(c.rotate) : undefined,
  });
}

/** Quebra por palavras para caber em `largura`; respeita '\n' do texto. */
export function quebrarLinhas(texto: string, largura: number, font: PDFFont, size: number): string[] {
  const out: string[] = [];
  for (const paragrafo of texto.split('\n')) {
    let atual = '';
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (atual && font.widthOfTextAtSize(tentativa, size) > largura) {
        out.push(atual);
        atual = palavra;
      } else {
        atual = tentativa;
      }
    }
    out.push(atual);
  }
  return out;
}

function destacarOverlay(page: PDFPage, c: CampoOverlay): void {
  const size = c.size ?? TAMANHO_PADRAO;
  page.drawRectangle({
    x: c.x,
    y: c.y - size * 0.25 - (c.linhas ? (c.lineHeight ?? size * 1.2) * (c.linhas - 1) : 0),
    width: c.maxWidth ?? Math.max(40, size * 6),
    height: c.linhas ? (c.lineHeight ?? size * 1.2) * (c.linhas - 1) + size * 1.2 : size * 1.2,
    rotate: c.rotate ? degrees(c.rotate) : undefined,
    color: DESTAQUE,
    opacity: 0.45,
  });
}

type Retangulo = { x: number; y: number; width: number; height: number };

function retangulosDoCampo(pdf: PDFDocument, form: PDFForm, nome: string): Array<{ page: PDFPage; rect: Retangulo }> {
  const out: Array<{ page: PDFPage; rect: Retangulo }> = [];
  for (const w of form.getField(nome).acroField.getWidgets()) {
    const ref = pdf.context.getObjectRef(w.dict);
    const page = ref ? pdf.findPageForAnnotationRef(ref) : undefined;
    if (page) out.push({ page, rect: w.getRectangle() });
  }
  return out;
}

/**
 * Caixas de seleção guardam a aparência como dicionário de estados (/N << /Off .. /0 .. >>).
 * O flatten do pdf-lib copia esse dicionário como XObject, que o pdf.js recusa ("XObject should
 * be a stream") e a caixa some da prévia. Antes de achatar, fica só o desenho do estado atual.
 */
function aparenciaDoEstadoAtual(form: PDFForm): void {
  for (const f of form.getFields()) {
    for (const w of f.acroField.getWidgets()) {
      const ap = w.dict.lookup(PDFName.of('AP'));
      if (!(ap instanceof PDFDict)) continue;
      for (const tipo of ['N', 'D', 'R']) {
        const valor = ap.lookup(PDFName.of(tipo));
        if (!(valor instanceof PDFDict) || valor instanceof PDFStream) continue;
        const estado = w.dict.get(PDFName.of('AS'));
        const desenho = estado instanceof PDFName ? valor.get(estado) : undefined;
        if (desenho) ap.set(PDFName.of(tipo), desenho);
        else ap.delete(PDFName.of(tipo));
      }
    }
  }
}

/**
 * Tira o fundo colorido que alguns PDFs põem nos campos (o verde dos TCLE do HUB) para não
 * sair na impressão. Só afeta a aparência do campo, não o conteúdo impresso do formulário.
 */
function removerFundoDosCampos(form: PDFForm): void {
  for (const f of form.getFields()) {
    for (const w of f.acroField.getWidgets()) {
      w.getAppearanceCharacteristics()?.dict.delete(PDFName.of('BG'));
    }
  }
}
