/**
 * Campo de busca numa tabela do SUS (procedimentos de APAC ou CID-10): digita código ou
 * palavras, escolhe na lista. O valor salvo é "CÓDIGO — NOME" (ver src/tabelas.ts).
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
}

const LIMITE = 40;

export function campoBusca(o: OpcoesCampoBusca): HTMLElement {
  const mostrar = (v: string) => {
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
  let escolhido = Boolean(lerValor(o.valor).codigo);
  let timer: number | undefined;
  let consulta = 0;
  let ultimaPrioridade: Set<string> | undefined;

  const fechar = () => {
    lista.hidden = true;
    entrada.setAttribute('aria-expanded', 'false');
    ativo = -1;
  };

  const escolher = (e: EntradaTabela) => {
    const v = valorDaEntrada(e);
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
      ativo = resultados.length ? 0 : -1;
      desenhar(prioridade);
    } catch (err) {
      if (minha === consulta) lista.replaceChildren(h('li', { class: 'sugestao vazia erro' }, (err as Error).message));
    }
  };

  entrada.addEventListener('input', () => {
    if (escolhido) {
      // mudou o texto depois de escolher: o valor anterior deixa de valer até escolher de novo
      escolhido = false;
      o.aoMudar('');
    }
    limpar.hidden = !entrada.value;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void atualizar(), 120);
  });
  entrada.addEventListener('focus', () => {
    if (!escolhido) void atualizar();
  });
  entrada.addEventListener('blur', () => window.setTimeout(fechar, 150));
  entrada.addEventListener('keydown', (ev) => {
    if (lista.hidden || !resultados.length) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      ativo = (ativo + (ev.key === 'ArrowDown' ? 1 : -1) + resultados.length) % resultados.length;
      desenhar(ultimaPrioridade);
    } else if (ev.key === 'Enter' && ativo >= 0) {
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
