import type { PDFFont } from 'pdf-lib';

/**
 * As fontes padrão do PDF (Helvetica) só codificam WinAnsi. Acentos do português estão lá;
 * o resto (emoji, setas, alguns travessões colados de outros sistemas) vira equivalente ou '?',
 * em vez de fazer o pdf-lib lançar exceção no meio da geração.
 */
const TROCAS: Record<string, string> = {
  ' ': ' ',
  '‐': '-',
  '‑': '-',
  '−': '-',
  '→': '->',
  '←': '<-',
  '≥': '>=',
  '≤': '<=',
};

export function paraWinAnsi(texto: string, font: PDFFont): string {
  const suportados = new Set(font.getCharacterSet());
  let out = '';
  for (const ch of texto.normalize('NFC').replace(/\r\n?/g, '\n')) {
    // \n quebra linha; \t é o marcador de tracejado (ver completarComTracos).
    if (ch === '\n' || ch === '\t') {
      out += ch;
      continue;
    }
    const troca = TROCAS[ch] ?? ch;
    for (const c of troca) {
      out += suportados.has(c.codePointAt(0)!) ? c : '?';
    }
  }
  return out;
}

/**
 * Em cada linha, troca o '\t' por um tracejado que leva o resto da linha até a margem direita:
 * "1. Dipirona 500 mg\t40 comprimidos" → "1. Dipirona 500 mg ------------ 40 comprimidos".
 * Sem largura conhecida (ou sem espaço), usa um tracejado curto.
 */
export function completarComTracos(texto: string, largura: number | undefined, font: PDFFont, size: number): string {
  const traco = font.widthOfTextAtSize('-', size);
  return texto
    .split('\n')
    .map((linha) => {
      const i = linha.indexOf('\t');
      if (i < 0) return linha;
      const esq = linha.slice(0, i).trimEnd();
      const dir = linha.slice(i + 1).replace(/\t/g, ' ').trimStart();
      const fixo = font.widthOfTextAtSize(`${esq}  ${dir}`, size);
      const n = largura ? Math.floor((largura - fixo) / traco) : 0;
      return `${esq} ${'-'.repeat(Math.max(4, n))} ${dir}`;
    })
    .join('\n');
}
