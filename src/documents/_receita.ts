import type { ExtraInput, ItemReceita, ValorExtra } from '../document';

/** Linha para escrever à mão quando o modelo não tem posologia. */
export const LINHA_EM_BRANCO = '_____________________________________________';

export const extrasReceita: ExtraInput[] = [
  {
    key: 'itens',
    label: 'Itens da receita',
    type: 'receita',
    modeloPadrao: 'sintomaticos',
    ajuda: 'Modelos editáveis na página Modelos (ADM). Posologia vazia sai em branco para escrever à mão.',
  },
];

export function itensSelecionados(v: ValorExtra | undefined): ItemReceita[] {
  return Array.isArray(v) ? (v as ItemReceita[]) : [];
}

/** Quantidade do item, como digitada no modelo ou na aba (sem cálculo). */
export function quantidade(it: ItemReceita): string {
  return it.quantidade?.trim() ?? '';
}

/**
 * Corpo da receita, um bloco por item:
 *   "1. <prescrição>\t<quantidade>"   (\t = tracejado até a margem, ver render/text.ts)
 *   "    <posologia>"
 */
export function textoReceita(itens: ItemReceita[]): string {
  return itens
    .map((it, i) => {
      const qtd = quantidade(it);
      const nome = `${i + 1}. ${it.prescricao.trim() || it.nome}`;
      const linha1 = qtd ? `${nome}\t${qtd}` : nome;
      const linha2 = `    ${it.posologia.trim() || LINHA_EM_BRANCO}`;
      return `${linha1}\n${linha2}`;
    })
    .join('\n\n');
}

/** `calcular` comum aos receituários. */
export function calcularReceita(_v: Record<string, string>, extra: Record<string, ValorExtra>): Record<string, string> {
  return { 'doc.corpo': textoReceita(itensSelecionados(extra.itens)) };
}
