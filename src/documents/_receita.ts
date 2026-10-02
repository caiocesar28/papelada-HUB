import type { ExtraInput, ItemReceita, ValorExtra } from '../document';

/** Linha para escrever à mão quando o modelo não tem posologia. */
export const LINHA_EM_BRANCO = '_____________________________________________';

/**
 * Formas de uso que podem sair como cabeçalho dos itens ("USO ORAL"). Escolha do médico na
 * tela ou no modelo; o app nunca deduz a via a partir do medicamento.
 */
export const VIAS = [
  'USO ORAL',
  'USO SUBLINGUAL',
  'USO TÓPICO',
  'USO OFTÁLMICO',
  'USO OTOLÓGICO',
  'USO NASAL',
  'USO INALATÓRIO',
  'USO RETAL',
  'USO VAGINAL',
  'USO SUBCUTÂNEO',
  'USO INTRAMUSCULAR',
  'USO INTRAVENOSO',
];

/** Seletor da forma de uso da lista inteira (vem antes dos itens na aba). */
export const extraVia: ExtraInput = {
  key: 'via',
  label: 'Forma de uso',
  type: 'select',
  opcoes: ['', ...VIAS],
  ajuda: 'Sai como cabeçalho antes dos itens. Um item pode ter outra forma de uso (detalhes do item).',
};

export const extrasReceita: ExtraInput[] = [
  extraVia,
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

/** Forma de uso do item: a dele, senão a da lista ('' = sem cabeçalho). */
export function viaDoItem(it: ItemReceita, viaLista = ''): string {
  return it.via?.trim() || viaLista.trim();
}

/**
 * Corpo da receita, um bloco por item:
 *   "1. <prescrição>\t<quantidade>"   (\t = tracejado até a margem, ver render/text.ts)
 *   "    <posologia>"
 * Com forma de uso, os itens são agrupados (na ordem em que cada forma aparece primeiro) e
 * cada grupo começa pelo cabeçalho ("USO ORAL"). A numeração continua entre os grupos.
 */
export function textoReceita(itens: ItemReceita[], viaLista = ''): string {
  const grupos = new Map<string, ItemReceita[]>();
  for (const it of itens) {
    const via = viaDoItem(it, viaLista);
    grupos.set(via, [...(grupos.get(via) ?? []), it]);
  }
  let n = 0;
  return [...grupos]
    .map(([via, doGrupo]) => {
      const blocos = doGrupo.map((it) => {
        const qtd = quantidade(it);
        const nome = `${++n}. ${it.prescricao.trim() || it.nome}`;
        const linha1 = qtd ? `${nome}\t${qtd}` : nome;
        const linha2 = `    ${it.posologia.trim() || LINHA_EM_BRANCO}`;
        return `${linha1}\n${linha2}`;
      });
      return (via ? `${via}\n\n` : '') + blocos.join('\n\n');
    })
    .join('\n\n');
}

/** `calcular` comum aos receituários. */
export function calcularReceita(_v: Record<string, string>, extra: Record<string, ValorExtra>): Record<string, string> {
  const via = typeof extra.via === 'string' ? extra.via : '';
  return { 'doc.corpo': textoReceita(itensSelecionados(extra.itens), via) };
}
