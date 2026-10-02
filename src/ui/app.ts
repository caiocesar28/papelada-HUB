import type { DocumentDef, EntradaLista, ExtraInput } from '../document';
import { quantidade } from '../documents/_receita';
import { TERMOS_COM_MODELO } from '../modelos';
import { ROTULOS_PACIENTE, type Paciente, type TipoHospital } from '../patient';
import { varianteDe } from '../registry';
import { carregarFormulario, contarFolhas, gerarDocumento, gerarLote, type DocumentoGerado } from '../render';
import { TIPOS } from '../tipos';
import { campo, h, type Attrs } from './dom';
import {
  adicionarItemAvulso,
  aplicarModeloReceita,
  aplicarModeloTcle,
  campoObrigatorio,
  camposPacienteUsados,
  contexto,
  documentosAtivos,
  estadoInicial,
  iniciarExtras,
  type Estado,
} from './estado';
import { campoBusca } from './busca';
import { mostrarPdf } from './preview';
import { carregarCompatibilidade, lerValor } from '../tabelas';

/** PDFs originais já baixados (não têm dado de paciente; sobrevivem a "Novo paciente"). */
const formularios = new Map<string, ArrayBuffer>();

/** O que sobrevive a "Novo paciente": hospital, documentos marcados e preferência de impressão. */
interface Preservado {
  hospital: Estado['hospital'];
  selecionados: Set<string>;
  juntarMeias: boolean;
}

export function iniciarApp(raiz: HTMLElement, preservado?: Preservado): void {
  const e = estadoInicial();
  if (preservado) {
    e.hospital = { ...preservado.hospital };
    e.selecionados = new Set(preservado.selecionados);
    e.juntarMeias = preservado.juntarMeias;
  }
  /** Listeners globais desta instância (removidos em "Novo paciente"). */
  const vida = new AbortController();
  let gerados: DocumentoGerado[] = [];
  let geracao = 0;
  let timer: number | undefined;

  // --- elementos fixos -------------------------------------------------------------

  const segmentoHospital = h('div', { class: 'segmento', role: 'radiogroup', 'aria-label': 'Hospital' });
  const nomeHospital = h('input', {
    type: 'text',
    placeholder: 'Ex.: HRAN',
    value: e.hospital.nome,
    oninput: (ev) => {
      e.hospital.nome = (ev.target as HTMLInputElement).value;
      agendar();
    },
  });
  const campoHospital = campo('Hospital ou unidade de saúde', nomeHospital);
  const inputNome = inputPaciente('nome', 'text');
  const listaDocs = h('div', { class: 'cartoes-docs' });
  const camposExtra = h('div', { class: 'grade-campos' });
  const blocoExtra = h(
    'section',
    { class: 'cartao' },
    h('h2', {}, h('span', { class: 'passo' }, '3'), 'Dados para os documentos'),
    camposExtra,
  );
  const resumoImpressao = h('p', { class: 'resumo-impressao' });
  const botaoImprimir = h(
    'button',
    { type: 'button', class: 'primario grande', onclick: () => void imprimir(), title: 'Ctrl+P' },
    'Imprimir documentos',
  );

  const abas = h('nav', { class: 'abas', role: 'tablist' });
  const ajustes = h('div', { class: 'ajustes' });
  const avisoVazios = h('div', { class: 'aviso-vazios' });
  const previa = h('div', { class: 'previa' });
  const vazioGeral = h(
    'div',
    { class: 'vazio-geral' },
    h('p', { class: 'vazio-titulo' }, 'Nenhum documento marcado'),
    h('p', {}, 'Preencha o paciente e marque os documentos ao lado. A prévia aparece aqui, já no formulário oficial.'),
  );
  const conteudoAba = h(
    'div',
    { class: 'conteudo-aba' },
    h('section', { class: 'cartao coluna-ajustes' }, ajustes),
    h('section', { class: 'coluna-previa' }, avisoVazios, h('div', { class: 'moldura-previa' }, previa)),
  );

  raiz.replaceChildren(
    h(
      'div',
      { class: 'layout' },
      h(
        'aside',
        { class: 'painel-dados' },
        h(
          'section',
          { class: 'cartao' },
          h('h2', {}, h('span', { class: 'passo' }, '1'), 'Paciente'),
          segmentoHospital,
          campoHospital,
          campo('Nome', inputNome),
          h(
            'div',
            { class: 'linha' },
            campo('Registro (prontuário)', inputPaciente('registro', 'text')),
            campo(
              'Data do documento',
              h('input', {
                type: 'date',
                value: e.dataIso,
                oninput: (ev) => {
                  e.dataIso = (ev.target as HTMLInputElement).value;
                  agendar();
                },
              }),
            ),
          ),
        ),
        h('section', { class: 'cartao' }, h('h2', {}, h('span', { class: 'passo' }, '2'), 'Documentos'), listaDocs),
        blocoExtra,
        h(
          'div',
          { class: 'rodape-dados' },
          botaoImprimir,
          h(
            'label',
            { class: 'opcao opcao-papel', title: 'Atestado, requisição de exames e retorno ocupam meia folha' },
            h('input', {
              type: 'checkbox',
              checked: e.juntarMeias,
              onchange: (ev) => {
                e.juntarMeias = (ev.target as HTMLInputElement).checked;
                atualizarResumo();
              },
            }),
            'Juntar meias folhas na mesma A4',
          ),
          resumoImpressao,
        ),
      ),
      h('div', { class: 'painel-docs' }, abas, vazioGeral, conteudoAba),
    ),
  );

  // Botão "Novo paciente" no cabeçalho (fora da raiz do app).
  const acoesTopo = document.querySelector('#acoes-topo');
  acoesTopo?.querySelector('.novo-paciente')?.remove();
  acoesTopo?.prepend(
    h('button', { type: 'button', class: 'botao-link novo-paciente', onclick: novoPaciente }, 'Novo paciente'),
  );

  renderHospital();
  aoMudarSelecao();
  inputNome.focus();

  // Ctrl+P imprime os documentos, não a página.
  window.addEventListener(
    'keydown',
    (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'p') {
        ev.preventDefault();
        void imprimir();
      }
    },
    { signal: vida.signal },
  );

  // --- paciente e hospital -----------------------------------------------------------

  function inputPaciente(k: keyof Paciente, type: string): HTMLInputElement | HTMLSelectElement {
    if (k === 'sexo') {
      return h(
        'select',
        {
          onchange: (ev) => {
            e.paciente.sexo = (ev.target as HTMLSelectElement).value as Paciente['sexo'];
            agendar();
          },
        },
        ...[['', '—'], ['F', 'Feminino'], ['M', 'Masculino']].map(([v, t]) =>
          h('option', { value: v, selected: e.paciente.sexo === v }, t),
        ),
      );
    }
    return h('input', {
      type,
      value: e.paciente[k],
      autocomplete: 'off',
      oninput: (ev) => {
        e.paciente[k] = (ev.target as HTMLInputElement).value as never;
        agendar();
      },
    });
  }

  function renderHospital(): void {
    campoHospital.hidden = e.hospital.tipo !== 'SES';
    segmentoHospital.replaceChildren(
      ...(['HUB', 'SES'] as TipoHospital[]).map((t) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': e.hospital.tipo === t ? 'true' : 'false',
            class: e.hospital.tipo === t ? 'ativo' : '',
            onclick: () => {
              if (e.hospital.tipo === t) return;
              e.hospital.tipo = t;
              renderHospital();
              aoMudarSelecao();
            },
          },
          t === 'HUB' ? 'HUB' : 'Outro (SES-DF)',
        ),
      ),
    );
  }

  function novoPaciente(): void {
    const temDados = Object.values(e.paciente).some((v) => v.trim());
    if (temDados && !window.confirm('Apagar os dados deste paciente e começar outro?\nOs documentos marcados continuam marcados.')) return;
    vida.abort();
    window.clearTimeout(timer);
    iniciarApp(raiz, { hospital: e.hospital, selecionados: e.selecionados, juntarMeias: e.juntarMeias });
  }

  // --- documentos ---------------------------------------------------------------------

  function renderDocs(): void {
    listaDocs.replaceChildren(
      ...TIPOS.map((t) => {
        const def = varianteDe(t.id, e.hospital.tipo);
        const marcado = e.selecionados.has(t.id);
        const g = def && gerados.find((x) => x.def.id === def.id);
        const n = g ? new Set(g.vazios.map((v) => v.label)).size : 0;
        const status = !def
          ? h('span', { class: 'status-doc indisponivel' }, `sem versão ${e.hospital.tipo}`)
          : !marcado || !g
            ? null
            : n
              ? h('span', { class: 'status-doc pendente' }, `${n} em branco`)
              : h('span', { class: 'status-doc pronto' }, 'pronto');
        return h(
          'label',
          { class: 'cartao-doc' + (marcado && def ? ' marcado' : '') + (def ? '' : ' indisponivel') },
          h('input', {
            type: 'checkbox',
            checked: marcado,
            disabled: !def,
            onchange: (ev) => {
              if ((ev.target as HTMLInputElement).checked) {
                e.selecionados.add(t.id);
                e.aba = t.id;
              } else {
                e.selecionados.delete(t.id);
              }
              aoMudarSelecao();
            },
          }),
          h('span', { class: 'texto-doc' }, h('strong', {}, t.titulo), h('small', {}, t.descricao)),
          status,
        );
      }),
    );
  }

  function aoMudarSelecao(): void {
    const defs = documentosAtivos(e);
    for (const d of defs) iniciarExtras(e, d);
    if (!defs.some((d) => d.tipo === e.aba)) e.aba = defs[0]?.tipo ?? null;

    const usados = camposPacienteUsados(defs);
    blocoExtra.hidden = usados.length === 0;
    camposExtra.replaceChildren(
      ...usados.map((k) =>
        campo(
          ROTULOS_PACIENTE[k] + (campoObrigatorio(defs, k) ? '' : ' (opcional)'),
          inputPaciente(k, k === 'dataNascimento' ? 'date' : 'text'),
        ),
      ),
    );

    renderDocs();
    renderAbas();
    renderAjustes();
    agendar(0);
  }

  function renderAbas(): void {
    const defs = documentosAtivos(e);
    vazioGeral.hidden = defs.length > 0;
    conteudoAba.hidden = defs.length === 0;
    abas.hidden = defs.length === 0;
    abas.replaceChildren(
      ...defs.map((d) => {
        const n = new Set(gerados.find((g) => g.def.id === d.id)?.vazios.map((v) => v.label)).size;
        const titulo = TIPOS.find((t) => t.id === d.tipo)!.titulo;
        return h(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: 'aba' + (d.tipo === e.aba ? ' ativa' : ''),
            'aria-selected': d.tipo === e.aba ? 'true' : 'false',
            onclick: () => {
              e.aba = d.tipo;
              renderAbas();
              renderAjustes();
              void mostrarAtiva();
            },
          },
          titulo,
          n ? h('span', { class: 'contador', title: `${n} campo(s) em branco` }, String(n)) : null,
        );
      }),
    );
  }

  // --- ajustes de cada documento -------------------------------------------------------

  function renderAjustes(): void {
    const def = documentosAtivos(e).find((d) => d.tipo === e.aba);
    if (!def) {
      ajustes.replaceChildren();
      return;
    }
    const filhos = [modeloTcle(def), ...(def.extraInputs ?? []).map((inp) => inputExtra(def, inp))].filter(
      (x): x is HTMLElement => x !== null,
    );
    ajustes.replaceChildren(
      h('h2', {}, def.title),
      ...(filhos.length ? filhos : [h('p', { class: 'nada' }, 'Este documento usa só os dados do paciente.')]),
    );
  }

  /** Bloco "Modelo de TCLE" (só para termos que aceitam modelo). */
  function modeloTcle(def: DocumentDef): HTMLElement | null {
    if (!(def.tipo in TERMOS_COM_MODELO)) return null;
    const modelos = e.modelos.tcles.filter((t) => t.termo === def.tipo);
    if (!modelos.length) {
      return h(
        'p',
        { class: 'dica' },
        'Nenhum modelo de TCLE ainda. ',
        h('a', { href: 'adm.html', target: '_blank' }, 'Criar em Modelos'),
        '.',
      );
    }
    const sel = h(
      'select',
      {},
      h('option', { value: '' }, '— escolher modelo —'),
      ...modelos.map((m) => h('option', { value: m.id }, m.nome)),
    );
    const aplicar = h(
      'button',
      {
        type: 'button',
        class: 'secundario',
        onclick: () => {
          if (!sel.value) return;
          aplicarModeloTcle(e, def.tipo, sel.value);
          aoMudarSelecao(); // redesenha diagnóstico/procedimento no painel e os campos desta aba
        },
      },
      'Aplicar',
    );
    return h(
      'div',
      { class: 'grupo' },
      h('h3', {}, 'Modelo de TCLE'),
      h('div', { class: 'linha alinhada' }, sel, aplicar),
      h('small', { class: 'dica' }, 'Preenche diagnóstico, procedimento, dispositivos e complicações. O texto do termo não muda.'),
    );
  }

  function inputExtra(def: DocumentDef, inp: ExtraInput): HTMLElement {
    const extras = e.extras[def.tipo];
    if (inp.type === 'receita') return listaReceita(def, inp);
    if (inp.type === 'lista') return listaEntradas(def, inp);
    if (inp.type === 'busca') {
      return campoBusca({
        rotulo: inp.label,
        valor: String(extras[inp.key] ?? ''),
        tabela: inp.tabela ?? 'cid10',
        apenasPrincipal: inp.apenasPrincipal,
        prioridade: inp.compativelCom ? () => cidsCompativeis(String(extras[inp.compativelCom!] ?? '')) : undefined,
        ajuda: inp.ajuda,
        aoMudar: (v) => {
          extras[inp.key] = v;
          agendar();
        },
      });
    }
    if (inp.type === 'checkbox') {
      return h(
        'label',
        { class: 'opcao' },
        h('input', {
          type: 'checkbox',
          checked: extras[inp.key] === true,
          onchange: (ev) => {
            extras[inp.key] = (ev.target as HTMLInputElement).checked;
            agendar();
          },
        }),
        inp.label,
      );
    }
    if (inp.type === 'select') {
      return campo(
        inp.label,
        h(
          'select',
          {
            onchange: (ev) => {
              extras[inp.key] = (ev.target as HTMLSelectElement).value;
              agendar();
            },
          },
          ...(inp.opcoes ?? []).map((o) => h('option', { value: o, selected: extras[inp.key] === o }, o || '—')),
        ),
        inp.ajuda,
      );
    }
    const atributos: Attrs = {
      value: String(extras[inp.key] ?? ''),
      placeholder: inp.placeholder,
      oninput: (ev) => {
        extras[inp.key] = (ev.target as HTMLInputElement).value;
        agendar();
      },
    };
    const el =
      inp.type === 'textarea'
        ? h('textarea', { ...atributos, rows: 4 })
        : h('input', { ...atributos, type: inp.type, min: inp.type === 'number' ? 0 : undefined });
    return campo(inp.label, el, inp.ajuda);
  }

  /** CIDs compatíveis com o procedimento escolhido (valor "CÓDIGO — NOME"), para ordenar a busca. */
  async function cidsCompativeis(procedimento: string): Promise<Set<string> | undefined> {
    const { codigo } = lerValor(procedimento);
    if (!codigo) return undefined;
    const compat = await carregarCompatibilidade();
    return compat[codigo] ? new Set(compat[codigo]) : undefined;
  }

  /** Entradas independentes (p.ex. cartões de retorno), cada uma com os mesmos campos. */
  function listaEntradas(def: DocumentDef, inp: ExtraInput): HTMLElement {
    const extras = e.extras[def.tipo];
    const lista = h('div', { class: 'lista-entradas' });
    const rotulo = inp.rotuloItem ?? 'Item';
    const max = inp.max ?? Infinity;
    const min = inp.min ?? 0;
    const entradas = () => extras[inp.key] as EntradaLista[];
    const adicionar = h(
      'button',
      {
        type: 'button',
        class: 'secundario',
        onclick: () => {
          entradas().push({});
          render();
          agendar();
        },
      },
      `+ Adicionar ${rotulo.toLowerCase()}`,
    );
    const render = () => {
      const itens = entradas();
      adicionar.hidden = itens.length >= max;
      lista.replaceChildren(
        ...itens.map((ent, i) =>
          h(
            'div',
            { class: 'entrada' },
            h(
              'div',
              { class: 'cabecalho-entrada' },
              h('strong', {}, `${rotulo} ${i + 1}`),
              itens.length > min
                ? h(
                    'button',
                    {
                      type: 'button',
                      class: 'remover',
                      onclick: () => {
                        itens.splice(i, 1);
                        render();
                        agendar();
                      },
                    },
                    'Remover',
                  )
                : null,
            ),
            ...(inp.campos ?? []).map((c) =>
              c.type === 'busca'
                ? campoBusca({
                    rotulo: c.label,
                    valor: ent[c.key] ?? '',
                    tabela: c.tabela ?? 'cid10',
                    apenasPrincipal: c.apenasPrincipal,
                    aoMudar: (v) => {
                      ent[c.key] = v;
                      agendar();
                    },
                  })
                : campo(
                    c.label,
                    h('input', {
                      type: c.type,
                      value: ent[c.key] ?? '',
                      placeholder: c.placeholder,
                      oninput: (ev) => {
                        ent[c.key] = (ev.target as HTMLInputElement).value;
                        agendar();
                      },
                    }),
                  ),
            ),
          ),
        ),
      );
    };
    render();
    return h(
      'div',
      { class: 'grupo' },
      h('h3', {}, inp.label),
      lista,
      adicionar,
      inp.ajuda ? h('small', { class: 'dica' }, inp.ajuda) : null,
    );
  }

  function listaReceita(def: DocumentDef, inp: ExtraInput): HTMLElement {
    const chave = `${def.tipo}.${inp.key}`;
    const lista = h('div', { class: 'receita' });

    const seletor = h(
      'select',
      {
        onchange: (ev) => {
          aplicarModeloReceita(e, def.tipo, inp.key, (ev.target as HTMLSelectElement).value);
          render();
          agendar();
        },
      },
      h('option', { value: '', selected: !e.modeloReceita[chave] }, '— nenhum modelo —'),
      ...e.modelos.receitas.map((m) =>
        h('option', { value: m.id, selected: e.modeloReceita[chave] === m.id }, m.nome),
      ),
    );
    const avulso = h(
      'button',
      {
        type: 'button',
        class: 'secundario',
        onclick: () => {
          adicionarItemAvulso(e, def.tipo, inp.key);
          render();
          agendar();
        },
      },
      '+ Item avulso',
    );

    const render = () => {
      const itens = e.receitas[def.tipo][inp.key];
      lista.replaceChildren(
        ...itens.map((it) => {
          const texto = (rotulo: string, prop: 'prescricao' | 'posologia' | 'quantidade', placeholder: string) =>
            campo(
              rotulo,
              h('input', {
                type: 'text',
                value: it[prop] ?? '',
                placeholder,
                oninput: (ev) => {
                  it[prop] = (ev.target as HTMLInputElement).value;
                  agendar();
                },
              }),
            );
          const qtd = quantidade(it);
          const detalhes = h(
            'div',
            { class: 'detalhes', hidden: !it.marcado },
            texto('Linha 1', 'prescricao', `${it.nome} (medicamento, concentração)`),
            texto('Quantidade', 'quantidade', 'ex.: 20 comprimidos (em branco = sai sem)'),
            texto('Posologia', 'posologia', 'em branco = linha para escrever à mão'),
          );
          return h(
            'div',
            { class: 'item' + (it.marcado ? ' marcado' : '') },
            h(
              'label',
              { class: 'opcao' },
              h('input', {
                type: 'checkbox',
                checked: it.marcado,
                onchange: (ev) => {
                  it.marcado = (ev.target as HTMLInputElement).checked;
                  render();
                  agendar();
                },
              }),
              h('span', { class: 'nome-item' }, it.nome),
              it.marcado && qtd ? h('small', { class: 'qtd' }, qtd) : null,
              it.marcado && !it.posologia.trim() ? h('small', { class: 'pendente' }, 'posologia em branco') : null,
            ),
            detalhes,
          );
        }),
      );
    };
    render();
    return h(
      'div',
      { class: 'grupo' },
      h('h3', {}, inp.label),
      campo('Modelo de receita', seletor),
      lista,
      avulso,
      inp.ajuda ? h('small', { class: 'dica' }, inp.ajuda) : null,
    );
  }

  // --- geração e pré-visualização -------------------------------------------------

  function agendar(ms = 250): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void atualizar(), ms);
  }

  async function bytesDo(def: DocumentDef): Promise<ArrayBuffer> {
    let b = formularios.get(def.form);
    if (!b) {
      b = await carregarFormulario(def);
      formularios.set(def.form, b);
    }
    return b;
  }

  async function atualizar(): Promise<void> {
    if (vida.signal.aborted) return;
    const minha = ++geracao;
    const defs = documentosAtivos(e);
    try {
      const novos: DocumentoGerado[] = [];
      for (const d of defs) {
        novos.push(await gerarDocumento(d, contexto(e, d), await bytesDo(d), { destacarVazios: true }));
      }
      if (minha !== geracao || vida.signal.aborted) return;
      gerados = novos;
      renderAbas();
      renderDocs();
      atualizarResumo();
      await mostrarAtiva();
    } catch (err) {
      console.error(err);
      if (minha === geracao) avisoVazios.replaceChildren(h('p', { class: 'erro' }, `Erro ao gerar: ${(err as Error).message}`));
    }
  }

  async function mostrarAtiva(): Promise<void> {
    const g = gerados.find((x) => x.def.tipo === e.aba);
    if (!g) {
      previa.replaceChildren();
      avisoVazios.replaceChildren();
      return;
    }
    const pendentes = [...new Set(g.vazios.map((v) => v.label))];
    avisoVazios.replaceChildren(
      pendentes.length
        ? h(
            'div',
            { class: 'pendencias' },
            h('span', {}, 'Em branco (amarelo na prévia):'),
            ...pendentes.map((p) => h('span', { class: 'chip' }, p)),
          )
        : h('div', { class: 'ok' }, '✓ Tudo preenchido'),
    );
    await mostrarPdf(previa, await g.pdf.save());
  }

  function atualizarResumo(): void {
    const comVazios = gerados.filter((g) => g.vazios.length);
    botaoImprimir.disabled = gerados.length === 0;
    const folhas = contarFolhas(gerados, e.juntarMeias);
    const papel = `${folhas} ${folhas === 1 ? 'folha' : 'folhas'}`;
    resumoImpressao.textContent = !gerados.length
      ? 'Marque ao menos um documento.'
      : comVazios.length
        ? `${gerados.length} documento(s), ${comVazios.length} com campos em branco · ${papel}.`
        : `${gerados.length} documento(s) prontos · ${papel}.`;
  }

  async function imprimir(): Promise<void> {
    const defs = documentosAtivos(e);
    if (!defs.length) return;
    const pendentes = gerados.filter((g) => g.vazios.length).map((g) => g.def.title);
    if (pendentes.length && !window.confirm(`Há campos em branco em: ${pendentes.join(', ')}.\nImprimir assim mesmo?`)) return;
    const finais: DocumentoGerado[] = [];
    for (const d of defs) finais.push(await gerarDocumento(d, contexto(e, d), await bytesDo(d)));
    const url = URL.createObjectURL(new Blob([new Uint8Array(await gerarLote(finais, { juntarMeias: e.juntarMeias }))], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    // O PDF fica só na memória; libera depois que a aba de impressão já carregou.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
