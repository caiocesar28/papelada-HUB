/**
 * Campo de busca numa tabela do SUS (procedimentos de APAC ou CID-10): digita código ou
 * palavras, escolhe na lista. O valor salvo é "CÓDIGO — NOME" (ver src/tabelas.ts).
 * Com `livre`, o texto digitado já é o valor (a lista só ajuda) e escolher uma entrada
 * escreve "NOME (CID K35.9)".
 */
import {
  buscar,
  carregarTabela,
  formatarCodigo,
  lerValor,
  valorDaEntrada,
  type EntradaTabela,
  type NomeTabela,
} from '../tabelas';
import { campo, h } from './dom';

export interface OpcoesCampoBusca {
  rotulo: string;
  valor: string;
  tabela: NomeTabela;
  apenasPrincipal?: boolean;
  /** Códigos que aparecem primeiro, marcados como compatíveis (p.ex. CIDs do procedimento). */
  prioridade?: () => Promise<Set<string> | undefined>;
  aoMudar: (valor: string) => void;
  placeholder?: string;
  ajuda?: string;
  /** Aceita texto livre; a tabela só sugere. */
  livre?: boolean;
}

const LIMITE = 40;

/** Valor de uma entrada escolhida num campo livre: "Apendicite aguda (CID K35.9)". */
export function textoLivre(tabela: NomeTabela, e: Pick<EntradaTabela, 'codigo' | 'nome'>): string {
  return tabela === 'cid10' ? `${e.nome} (CID ${formatarCodigo(tabela, e.codigo)})` : `${e.nome} (${formatarCodigo(tabela, e.codigo)})`;
}

export function campoBusca(o: OpcoesCampoBusca): HTMLElement {
  const mostrar = (v: string) => {
    if (o.livre) return v;
    const { codigo, nome } = lerValor(v);
    return codigo ? `${formatarCodigo(o.tabela, codigo)} — ${nome}` : v;
  };
  const entrada = h('input', {
    type: 'text',
    value: mostrar(o.valor),
    placeholder: o.placeholder ?? (o.tabela === 'cid10' ? 'Código (ex.: K35) ou palavras' : 'Código ou palavras do procedimento'),
    autocomplete: 'off',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
  });
  const lista = h('ul', { class: 'sugestoes', role: 'listbox', hidden: true });
  const limpar = h('button', { type: 'button', class: 'limpar-busca', title: 'Limpar', hidden: !o.valor }, '×');
  let resultados: EntradaTabela[] = [];
  let ativo = -1;
  let escolhido = !o.livre && Boolean(lerValor(o.valor).codigo);
  let timer: number | undefined;
  let consulta = 0;
  let ultimaPrioridade: Set<string> | undefined;

  const fechar = () => {
    lista.hidden = true;
    entrada.setAttribute('aria-expanded', 'false');
    ativo = -1;
  };

  const escolher = (e: EntradaTabela) => {
    const v = o.livre ? textoLivre(o.tabela, e) : valorDaEntrada(e);
    entrada.value = mostrar(v);
    escolhido = true;
    limpar.hidden = false;
    o.aoMudar(v);
    fechar();
  };

  const desenhar = (prioridade?: Set<string>) => {
    lista.replaceChildren(
      ...(resultados.length
        ? resultados.map((r, i) =>
            h(
              'li',
              {
                role: 'option',
                class: 'sugestao' + (i === ativo ? ' ativa' : ''),
                'aria-selected': i === ativo ? 'true' : 'false',
                onmousedown: (ev) => ev.preventDefault(), // não perde o foco antes do clique
                onclick: () => escolher(r),
              },
              h('span', { class: 'codigo' }, formatarCodigo(o.tabela, r.codigo)),
              h('span', { class: 'nome' }, r.nome),
              prioridade?.has(r.codigo) ? h('small', { class: 'compativel' }, 'compatível') : null,
            ),
          )
        : [h('li', { class: 'sugestao vazia' }, 'Nada encontrado.')]),
    );
    lista.hidden = false;
    entrada.setAttribute('aria-expanded', 'true');
  };

  const atualizar = async () => {
    const minha = ++consulta;
    const termo = entrada.value.trim();
    const prioridade = await o.prioridade?.();
    ultimaPrioridade = prioridade;
    if (!termo && !prioridade?.size) {
      fechar();
      return;
    }
    lista.replaceChildren(h('li', { class: 'sugestao vazia' }, 'Carregando tabela…'));
    lista.hidden = false;
    try {
      const tabela = await carregarTabela(o.tabela);
      if (minha !== consulta) return;
      resultados = buscar(tabela, termo, { limite: LIMITE, prioridade, apenasPrincipal: o.apenasPrincipal });
      // campo vazio: só os compatíveis (o resto da tabela aparece ao digitar)
      if (!termo && prioridade) resultados = resultados.filter((r) => prioridade.has(r.codigo));
      // texto livre: Enter não troca o que foi digitado pela 1ª sugestão
      ativo = resultados.length && !o.livre ? 0 : -1;
      desenhar(prioridade);
    } catch (err) {
      if (minha === consulta) lista.replaceChildren(h('li', { class: 'sugestao vazia erro' }, (err as Error).message));
    }
  };

  entrada.addEventListener('input', () => {
    if (o.livre) {
      o.aoMudar(entrada.value);
    } else if (escolhido) {
      // mudou o texto depois de escolher: o valor anterior deixa de valer até escolher de novo
      escolhido = false;
      o.aoMudar('');
    }
    limpar.hidden = !entrada.value;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void atualizar(), 120);
  });
  entrada.addEventListener('focus', () => {
    if (!escolhido && !o.livre) void atualizar();
  });
  entrada.addEventListener('blur', () => window.setTimeout(fechar, 150));
  entrada.addEventListener('keydown', (ev) => {
    if (lista.hidden || !resultados.length) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      ativo = (ativo + (ev.key === 'ArrowDown' ? 1 : -1) + resultados.length) % resultados.length;
      desenhar(ultimaPrioridade);
    } else if (ev.key === 'Enter' && ativo >= 0 && ativo < resultados.length) {
      ev.preventDefault();
      escolher(resultados[ativo]);
    } else if (ev.key === 'Escape') {
      fechar();
    }
  });
  limpar.addEventListener('click', () => {
    entrada.value = '';
    escolhido = false;
    limpar.hidden = true;
    o.aoMudar('');
    entrada.focus();
  });

  return campo(o.rotulo, h('div', { class: 'busca' }, entrada, limpar, lista), o.ajuda);
}
