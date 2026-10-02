/**
 * Página ADM: edita um RASCUNHO dos modelos de receita e de TCLE.
 *
 * O rascunho fica só neste navegador e não muda o app de ninguém. Para valer para todos, o
 * rascunho é publicado no repositório (src/presets/modelos.json) por quem tem permissão de
 * escrita no GitHub; o deploy é automático. Assim, quem autoriza é o GitHub, sem senha no código.
 */
import '../style.css';
import './adm.css';
import { ARQUIVO_MODELOS, URL_EDITAR_MODELOS, URL_REPO } from '../config';
import type { ItemReceita } from '../document';
import { VIAS, textoReceita } from '../documents/_receita';
import {
  CHAVE_RASCUNHO,
  PUBLICADOS,
  TERMOS_COM_MODELO,
  comparar,
  descartarRascunho,
  gravarRascunho,
  lerRascunho,
  novoId,
  paraJson,
  validarModelos,
  type ModeloReceita,
  type ModeloTcle,
  type Modelos,
  type Situacao,
} from '../modelos';
import { paraIso, partesNoFuso } from '../patient';
import { campo, h } from '../ui/dom';

type Secao = 'receitas' | 'tcles';

const raiz = document.querySelector<HTMLElement>('#adm')!;
let rascunho: Modelos = lerRascunho() ?? structuredClone(PUBLICADOS);
let secao: Secao = 'receitas';
let selecionado: string | null = null;
let timerSalvar: number | undefined;
let atualizarPrevia: () => void = () => {};

const status = h('span', { class: 'status' });
const painelRascunho = h('section', { class: 'cartao painel-rascunho' });
const lista = h('nav', { class: 'lista-modelos' });
const editor = h('section', { class: 'editor' });
const abas = h('div', { class: 'abas' });
const arquivo = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: () => void importar() });

// --- render ---------------------------------------------------------------------

function render(): void {
  renderRascunho();
  renderAbas();
  renderLista();
  renderEditor();
}

function renderRascunho(): void {
  const { situacao, removidos, mudou } = comparar(PUBLICADOS, rascunho);
  const conta = (s: Situacao) => Object.values(situacao).filter((x) => x === s).length;
  const partes = [
    conta('alterado') && `${conta('alterado')} alterado(s)`,
    conta('novo') && `${conta('novo')} novo(s)`,
    removidos.length && `${removidos.length} removido(s)`,
  ].filter(Boolean);
  painelRascunho.classList.toggle('com-mudancas', mudou);
  painelRascunho.replaceChildren(
    h(
      'div',
      { class: 'texto-rascunho' },
      h('strong', {}, mudou ? `Rascunho: ${partes.join(', ')}` : 'Rascunho igual ao publicado'),
      h(
        'small',
        {},
        mudou
          ? 'Só você vê estas mudanças. Publique no GitHub para valer no app de todos.'
          : 'Edite à vontade: nada muda para os outros até você publicar no GitHub.',
      ),
    ),
    h(
      'div',
      { class: 'acoes-modelos' },
      status,
      h('button', { type: 'button', onclick: exportar }, 'Exportar'),
      h('button', { type: 'button', onclick: () => arquivo.click() }, 'Importar'),
      mudou ? h('button', { type: 'button', class: 'perigo', onclick: descartar }, 'Descartar rascunho') : null,
      h('button', { type: 'button', class: 'primario', disabled: !mudou, onclick: () => void publicar() }, 'Publicar no GitHub'),
    ),
  );
}

function renderAbas(): void {
  const aba = (s: Secao, rotulo: string) =>
    h(
      'button',
      {
        type: 'button',
        class: 'aba' + (secao === s ? ' ativa' : ''),
        onclick: () => {
          secao = s;
          selecionado = null;
          render();
        },
      },
      rotulo,
    );
  abas.replaceChildren(aba('receitas', 'Receitas'), aba('tcles', 'TCLE'));
}

function renderLista(): void {
  const todos = rascunho[secao] as Array<ModeloReceita | ModeloTcle>;
  const { situacao } = comparar(PUBLICADOS, rascunho);
  if (!selecionado || !todos.some((m) => m.id === selecionado)) selecionado = todos[0]?.id ?? null;
  lista.replaceChildren(
    h('button', { type: 'button', class: 'primario', onclick: criar }, secao === 'receitas' ? '+ Nova receita' : '+ Novo TCLE'),
    ...todos.map((m) =>
      h(
        'button',
        {
          type: 'button',
          class: 'modelo' + (m.id === selecionado ? ' ativo' : ''),
          onclick: () => {
            selecionado = m.id;
            renderLista();
            renderEditor();
          },
        },
        h('span', {}, m.nome || '(sem nome)'),
        h('small', { class: `origem ${situacao[m.id]}` }, situacao[m.id]),
      ),
    ),
    ...(todos.length ? [] : [h('p', { class: 'nada' }, 'Nenhum modelo ainda.')]),
  );
}

function renderEditor(): void {
  const m = (rascunho[secao] as Array<ModeloReceita | ModeloTcle>).find((x) => x.id === selecionado);
  if (!m) {
    editor.replaceChildren(h('p', { class: 'nada' }, 'Crie um modelo para começar.'));
    return;
  }
  editor.replaceChildren(
    ...(secao === 'receitas' ? editorReceita(m as ModeloReceita) : editorTcle(m as ModeloTcle)),
    h(
      'div',
      { class: 'rodape-editor' },
      h('button', { type: 'button', onclick: duplicar }, 'Duplicar'),
      h('button', { type: 'button', class: 'perigo', onclick: excluir }, 'Excluir'),
    ),
  );
}

// --- edição ---------------------------------------------------------------------------

function salvar(redesenharLista = false): void {
  window.clearTimeout(timerSalvar);
  status.textContent = 'salvando…';
  timerSalvar = window.setTimeout(() => {
    try {
      gravarRascunho(rascunho);
      status.textContent = 'rascunho salvo';
    } catch (e) {
      status.textContent = `não salvou: ${(e as Error).message}`;
    }
    renderRascunho();
    if (redesenharLista) renderLista();
  }, 300);
}

function texto(
  rotulo: string,
  valor: string,
  aoMudar: (v: string) => void,
  opts: { area?: boolean; placeholder?: string } = {},
): HTMLElement {
  const attrs = {
    value: valor,
    placeholder: opts.placeholder,
    oninput: (ev: Event) => {
      aoMudar((ev.target as HTMLInputElement).value);
      salvar(true);
    },
  };
  return campo(rotulo, opts.area ? h('textarea', { ...attrs, rows: 5 }) : h('input', { ...attrs, type: 'text' }));
}

function editorReceita(m: ModeloReceita): HTMLElement[] {
  const previa = h('pre', { class: 'previa-texto' });
  atualizarPrevia = () => {
    const marcados = m.itens.filter((i) => i.padrao);
    previa.textContent = marcados.length
      ? textoReceita(marcados).replace(/\t/g, ' ------------ ')
      : '(nenhum item marcado por padrão)';
  };

  const itens = h('div', { class: 'itens' });
  const renderItens = () => {
    itens.replaceChildren(
      ...m.itens.map((it, i) => {
        const mudar = (f: (x: ItemReceita) => void) => {
          f(it);
          atualizarPrevia();
        };
        const mover = (d: -1 | 1) => {
          const j = i + d;
          if (j < 0 || j >= m.itens.length) return;
          [m.itens[i], m.itens[j]] = [m.itens[j], m.itens[i]];
          salvar(true);
          renderItens();
          atualizarPrevia();
        };
        return h(
          'div',
          { class: 'item-modelo' },
          h(
            'div',
            { class: 'linha cabecalho-item' },
            h(
              'label',
              { class: 'opcao' },
              h('input', {
                type: 'checkbox',
                checked: it.padrao === true,
                onchange: (ev) => {
                  mudar((x) => {
                    if ((ev.target as HTMLInputElement).checked) x.padrao = true;
                    else delete x.padrao;
                  });
                  salvar(true);
                },
              }),
              'marcado por padrão',
            ),
            h('span', { class: 'espaco' }),
            h('button', { type: 'button', title: 'Subir', onclick: () => mover(-1) }, '↑'),
            h('button', { type: 'button', title: 'Descer', onclick: () => mover(1) }, '↓'),
            h(
              'button',
              {
                type: 'button',
                class: 'perigo',
                onclick: () => {
                  m.itens.splice(i, 1);
                  salvar(true);
                  renderItens();
                  atualizarPrevia();
                },
              },
              'Remover',
            ),
          ),
          texto('Nome na lista', it.nome, (v) => mudar((x) => (x.nome = v)), { placeholder: 'Ex.: Dipirona' }),
          texto('Linha 1: medicamento e concentração', it.prescricao, (v) => mudar((x) => (x.prescricao = v)), {
            placeholder: 'Ex.: Dipirona 500 mg',
          }),
          texto('Linha 2: posologia', it.posologia, (v) => mudar((x) => (x.posologia = v)), {
            placeholder: 'em branco = linha para escrever à mão',
          }),
          texto(
            'Quantidade',
            it.quantidade ?? '',
            (v) =>
              mudar((x) => {
                if (v.trim()) x.quantidade = v;
                else delete x.quantidade;
              }),
            { placeholder: 'Ex.: 20 comprimidos (em branco = sai sem quantidade)' },
          ),
          campo(
            'Forma de uso',
            h(
              'select',
              {
                onchange: (ev) => {
                  const v = (ev.target as HTMLSelectElement).value;
                  mudar((x) => {
                    if (v) x.via = v;
                    else delete x.via;
                  });
                  salvar(true);
                },
              },
              h('option', { value: '', selected: !it.via }, '— a da lista (escolhida na receita) —'),
              ...VIAS.map((v) => h('option', { value: v, selected: it.via === v }, v)),
            ),
          ),
        );
      }),
    );
  };
  renderItens();
  atualizarPrevia();

  return [
    texto('Nome do modelo', m.nome, (v) => (m.nome = v), { placeholder: 'Ex.: Pós-operatório' }),
    h('h3', {}, 'Itens'),
    itens,
    h(
      'button',
      {
        type: 'button',
        onclick: () => {
          m.itens.push({ id: novoId('item'), nome: '', prescricao: '', posologia: '' });
          salvar(true);
          renderItens();
        },
      },
      '+ Adicionar item',
    ),
    h('h3', {}, 'Como sai na receita (itens marcados por padrão)'),
    previa,
  ];
}

function editorTcle(m: ModeloTcle): HTMLElement[] {
  const termo = h(
    'select',
    {
      onchange: (ev) => {
        m.termo = (ev.target as HTMLSelectElement).value;
        salvar(true);
      },
    },
    ...Object.entries(TERMOS_COM_MODELO).map(([id, t]) => h('option', { value: id, selected: m.termo === id }, t)),
  );
  return [
    texto('Nome do modelo', m.nome, (v) => (m.nome = v), { placeholder: 'Ex.: Apendicectomia' }),
    campo('Termo', termo),
    h('p', { class: 'nota' }, 'O texto do termo não muda. Estes são os espaços em branco que o TCLE deixa para preencher.'),
    texto('Diagnóstico', m.diagnostico, (v) => (m.diagnostico = v)),
    texto('Cirurgia ou procedimento', m.procedimento, (v) => (m.procedimento = v)),
    texto('Dispositivos ou estomas (item 2)', m.dispositivos, (v) => (m.dispositivos = v), {
      placeholder: 'em branco se não houver',
    }),
    texto('Outras complicações e necessidades (item 6)', m.complicacoes, (v) => (m.complicacoes = v), { area: true }),
  ];
}

// --- ações ------------------------------------------------------------------------

function criar(): void {
  if (secao === 'receitas') {
    const m: ModeloReceita = { id: novoId('receita'), nome: 'Nova receita', itens: [] };
    rascunho.receitas.push(m);
    selecionado = m.id;
  } else {
    const m: ModeloTcle = {
      id: novoId('tcle'),
      nome: 'Novo TCLE',
      termo: Object.keys(TERMOS_COM_MODELO)[0],
      diagnostico: '',
      procedimento: '',
      dispositivos: '',
      complicacoes: '',
    };
    rascunho.tcles.push(m);
    selecionado = m.id;
  }
  salvar();
  render();
}

function duplicar(): void {
  const m = (rascunho[secao] as Array<ModeloReceita | ModeloTcle>).find((x) => x.id === selecionado);
  if (!m) return;
  const copia = { ...structuredClone(m), id: novoId(secao === 'receitas' ? 'receita' : 'tcle'), nome: `${m.nome} (cópia)` };
  (rascunho[secao] as Array<typeof copia>).push(copia);
  selecionado = copia.id;
  salvar();
  render();
}

function excluir(): void {
  const m = (rascunho[secao] as Array<ModeloReceita | ModeloTcle>).find((x) => x.id === selecionado);
  if (!m || !window.confirm(`Excluir "${m.nome}" do rascunho?`)) return;
  if (secao === 'receitas') rascunho.receitas = rascunho.receitas.filter((x) => x.id !== m.id);
  else rascunho.tcles = rascunho.tcles.filter((x) => x.id !== m.id);
  salvar();
  render();
}

function descartar(): void {
  if (!window.confirm('Descartar todas as mudanças do rascunho e voltar ao que está publicado?')) return;
  descartarRascunho();
  rascunho = structuredClone(PUBLICADOS);
  selecionado = null;
  status.textContent = '';
  render();
}

function baixar(nome: string, conteudo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
  h('a', { href: url, download: nome }).click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function exportar(): void {
  baixar(`modelos-papelada-hub-${paraIso(partesNoFuso(new Date()))}.json`, paraJson(rascunho));
}

async function importar(): Promise<void> {
  const f = arquivo.files?.[0];
  arquivo.value = '';
  if (!f) return;
  try {
    const importados = validarModelos(JSON.parse(await f.text()));
    const pergunta = `Substituir o rascunho por ${importados.receitas.length} receita(s) e ${importados.tcles.length} TCLE(s) do arquivo?`;
    if (!window.confirm(pergunta)) return;
    rascunho = importados;
    gravarRascunho(rascunho);
    status.textContent = 'importado para o rascunho';
    render();
  } catch (e) {
    window.alert(`Não foi possível importar: ${(e as Error).message}`);
  }
}

/** Copia o JSON e abre o arquivo no GitHub; o commit (ou a proposta de mudança) é feito lá. */
async function publicar(): Promise<void> {
  let json: string;
  try {
    json = paraJson(rascunho);
  } catch (e) {
    window.alert(`O rascunho tem um problema: ${(e as Error).message}`);
    return;
  }
  let copiado = false;
  try {
    await navigator.clipboard.writeText(json);
    copiado = true;
  } catch {
    baixar('modelos.json', json);
  }
  const dialogo = h(
    'dialog',
    { class: 'dialogo-publicar' },
    h('h2', {}, 'Publicar no GitHub'),
    h(
      'ol',
      {},
      h(
        'li',
        {},
        copiado
          ? 'O conteúdo novo do arquivo já foi copiado.'
          : 'Não deu para copiar automaticamente: o arquivo modelos.json foi baixado. Abra-o e copie todo o conteúdo.',
      ),
      h(
        'li',
        {},
        h('a', { href: URL_EDITAR_MODELOS, target: '_blank', rel: 'noopener' }, `Abra ${ARQUIVO_MODELOS} no GitHub`),
        ' (entre na sua conta).',
      ),
      h('li', {}, 'Lá, selecione tudo (Ctrl+A), cole (Ctrl+V) e clique em ', h('strong', {}, 'Commit changes'), '.'),
      h('li', {}, 'Em 1 a 2 minutos o site atualiza para todos. Depois, use "Descartar rascunho" aqui.'),
    ),
    h(
      'p',
      { class: 'nota' },
      'Só quem tem permissão de escrita no ',
      h('a', { href: URL_REPO, target: '_blank', rel: 'noopener' }, 'repositório'),
      ' consegue salvar. Para os outros, o GitHub oferece "Propose changes", e o dono aprova ou recusa.',
    ),
    h(
      'div',
      { class: 'rodape-editor' },
      h('button', { type: 'button', onclick: () => void navigator.clipboard?.writeText(json) }, 'Copiar de novo'),
      h('button', { type: 'button', class: 'primario', onclick: () => dialogo.close() }, 'Fechar'),
    ),
  );
  dialogo.addEventListener('close', () => dialogo.remove());
  document.body.append(dialogo);
  dialogo.showModal();
}

// --- início (no fim do arquivo: tudo acima já está declarado) -----------------------

raiz.replaceChildren(
  h(
    'div',
    { class: 'adm' },
    painelRascunho,
    h('div', { class: 'topo' }, h('h1', {}, 'Modelos'), abas, arquivo),
    h('div', { class: 'corpo' }, lista, editor),
  ),
);

// Outra aba da ADM salvou o rascunho: recarrega.
window.addEventListener('storage', (ev) => {
  if (ev.key !== CHAVE_RASCUNHO) return;
  rascunho = lerRascunho() ?? structuredClone(PUBLICADOS);
  render();
});

render();
