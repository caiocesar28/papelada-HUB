import type { ExtraInput, ItemReceita, ValorExtra } from '../document';

/** Linha para escrever à mão quando o modelo não tem posologia. */
export const LINHA_EM_BRANCO = '_____________________________________________';

export const DIAS_PADRAO = '5';

export const extrasReceita: ExtraInput[] = [
  { key: 'dias', label: 'Dias de tratamento', type: 'number', padrao: DIAS_PADRAO },
  {
    key: 'itens',
    label: 'Itens da receita',
    type: 'receita',
    modeloPadrao: 'sintomaticos',
    ajuda: 'Modelos editáveis na página Modelos (ADM). Posologia vazia sai em branco para escrever à mão.',
  },
];

export function itensSelecionados(v: ValorExtra | undefined): ItemReceita[] {
  return Array.isArray(v) ? v : [];
}

/** Quantidade do item: a digitada, ou porDose × vezesAoDia × dias na unidade do modelo. */
export function quantidade(it: ItemReceita, dias: number): string {
  if (it.quantidade?.trim()) return it.quantidade.trim();
  if (!it.porDose || !it.vezesAoDia || !(dias > 0)) return '';
  const total = it.porDose * it.vezesAoDia * dias;
  const unidade = (it.unidade || 'comprimidos').trim();
  return `${total} ${total === 1 ? unidade.replace(/s$/, '') : unidade}`;
}

/**
 * Corpo da receita, um bloco por item:
 *   "1. <prescrição>\t<quantidade>"   (\t = tracejado até a margem, ver render/text.ts)
 *   "    <posologia>"
 */
export function textoReceita(itens: ItemReceita[], dias: number): string {
  return itens
    .map((it, i) => {
      const qtd = quantidade(it, dias);
      const nome = `${i + 1}. ${it.prescricao.trim() || it.nome}`;
      const linha1 = qtd ? `${nome}\t${qtd}` : nome;
      const linha2 = `    ${it.posologia.trim() || LINHA_EM_BRANCO}`;
      return `${linha1}\n${linha2}`;
    })
    .join('\n\n');
}

/** `calcular` comum aos receituários. */
export function calcularReceita(v: Record<string, string>, extra: Record<string, ValorExtra>): Record<string, string> {
  return { 'doc.corpo': textoReceita(itensSelecionados(extra.itens), Number(v['extra.dias'])) };
}
