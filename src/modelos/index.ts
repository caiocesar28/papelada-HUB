/**
 * Modelos de receita e de TCLE.
 *
 * Fonte da verdade: src/presets/modelos.json, no repositório. O app usa SÓ esse arquivo.
 * Só quem tem permissão de escrita no GitHub consegue alterá-lo (commit → deploy automático).
 *
 * A página ADM edita um RASCUNHO que fica no localStorage do navegador de quem edita (modelo
 * não é dado de paciente) e não afeta ninguém até ser publicado no GitHub.
 */
import type { ItemReceita } from '../document';
import publicados from '../presets/modelos.json';

export interface ModeloReceita {
  id: string;
  nome: string;
  itens: ItemReceita[];
}

/**
 * Valores dos campos que o TCLE deixa em aberto. O corpo do termo nunca é alterado
 * (princípio 3); o modelo só preenche estes campos.
 */
export interface ModeloTcle {
  id: string;
  nome: string;
  /** Tipo do documento de TCLE (src/tipos.ts), p.ex. 'tcle-cirurgia'. */
  termo: string;
  diagnostico: string;
  procedimento: string;
  dispositivos: string;
  complicacoes: string;
}

export interface Modelos {
  receitas: ModeloReceita[];
  tcles: ModeloTcle[];
}

/** Termos que aceitam modelo (tipo → título). */
export const TERMOS_COM_MODELO: Record<string, string> = {
  'tcle-cirurgia': 'TCLE cirurgia',
};

export const CHAVE_RASCUNHO = 'papelada-hub.rascunho-modelos.v1';

// --- validação -------------------------------------------------------------------

function texto(v: unknown, campo: string): string {
  if (typeof v !== 'string') throw new Error(`campo '${campo}' deveria ser texto`);
  return v;
}

function validarItem(v: unknown, onde: string): ItemReceita {
  if (!v || typeof v !== 'object') throw new Error(`${onde}: item inválido`);
  const o = v as Record<string, unknown>;
  const item: ItemReceita = {
    id: texto(o.id, `${onde}.id`),
    nome: texto(o.nome, `${onde}.nome`),
    prescricao: texto(o.prescricao ?? '', `${onde}.prescricao`),
    posologia: texto(o.posologia ?? '', `${onde}.posologia`),
  };
  // porDose/vezesAoDia/unidade (versão antiga, com cálculo) são ignorados.
  if (o.quantidade !== undefined && o.quantidade !== '') item.quantidade = texto(o.quantidade, `${onde}.quantidade`);
  if (o.via !== undefined && o.via !== '') item.via = texto(o.via, `${onde}.via`);
  if (o.padrao === true) item.padrao = true;
  return item;
}

function idsUnicos(lista: Array<{ id: string }>, onde: string): void {
  const vistos = new Set<string>();
  for (const x of lista) {
    if (vistos.has(x.id)) throw new Error(`${onde}: id repetido '${x.id}'`);
    vistos.add(x.id);
  }
}

/** Valida o arquivo de modelos (do repositório ou importado). Lança Error com o motivo. */
export function validarModelos(v: unknown): Modelos {
  if (!v || typeof v !== 'object') throw new Error('arquivo de modelos inválido');
  const o = v as Record<string, unknown>;
  const receitas = Array.isArray(o.receitas) ? o.receitas : [];
  const tcles = Array.isArray(o.tcles) ? o.tcles : [];
  const m: Modelos = {
    receitas: receitas.map((r, i) => {
      const x = r as Record<string, unknown>;
      if (!Array.isArray(x?.itens)) throw new Error(`receita ${i + 1}: sem itens`);
      const itens = x.itens.map((it, j) => validarItem(it, `receitas[${i}].itens[${j}]`));
      idsUnicos(itens, `receitas[${i}].itens`);
      return { id: texto(x.id, `receitas[${i}].id`), nome: texto(x.nome, `receitas[${i}].nome`), itens };
    }),
    tcles: tcles.map((t, i) => {
      const x = t as Record<string, unknown>;
      const termo = texto(x?.termo, `tcles[${i}].termo`);
      if (!(termo in TERMOS_COM_MODELO)) throw new Error(`tcles[${i}]: termo desconhecido '${termo}'`);
      return {
        id: texto(x.id, `tcles[${i}].id`),
        nome: texto(x.nome, `tcles[${i}].nome`),
        termo,
        diagnostico: texto(x.diagnostico ?? '', `tcles[${i}].diagnostico`),
        procedimento: texto(x.procedimento ?? '', `tcles[${i}].procedimento`),
        dispositivos: texto(x.dispositivos ?? '', `tcles[${i}].dispositivos`),
        complicacoes: texto(x.complicacoes ?? '', `tcles[${i}].complicacoes`),
      };
    }),
  };
  idsUnicos(m.receitas, 'receitas');
  idsUnicos(m.tcles, 'tcles');
  return m;
}

/** Modelos publicados no repositório (os únicos que o app usa). */
export const PUBLICADOS: Modelos = validarModelos(publicados);

/** JSON no formato exato do arquivo do repositório (para colar no GitHub). */
export function paraJson(m: Modelos): string {
  return JSON.stringify(validarModelos(m), null, 2) + '\n';
}

// --- rascunho (só na página ADM) -----------------------------------------------------

export function lerRascunho(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): Modelos | null {
  try {
    const bruto = storage?.getItem(CHAVE_RASCUNHO);
    return bruto ? validarModelos(JSON.parse(bruto)) : null;
  } catch (e) {
    console.warn('rascunho de modelos ignorado:', e);
    return null;
  }
}

export function gravarRascunho(m: Modelos, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  storage?.setItem(CHAVE_RASCUNHO, JSON.stringify(m));
}

export function descartarRascunho(storage: Pick<Storage, 'removeItem'> | undefined = globalThis.localStorage): void {
  storage?.removeItem(CHAVE_RASCUNHO);
}

export type Situacao = 'publicado' | 'alterado' | 'novo';

/** Situação de cada modelo do rascunho em relação ao publicado, e os que o rascunho removeu. */
export function comparar(
  publicado: Modelos,
  rascunho: Modelos,
): { situacao: Record<string, Situacao>; removidos: string[]; mudou: boolean } {
  const situacao: Record<string, Situacao> = {};
  const removidos: string[] = [];
  for (const k of ['receitas', 'tcles'] as const) {
    const pub = new Map<string, unknown>(publicado[k].map((m) => [m.id, m]));
    for (const m of rascunho[k]) {
      const p = pub.get(m.id);
      situacao[m.id] = !p ? 'novo' : JSON.stringify(validarModelos({ [k]: [p] })) === JSON.stringify(validarModelos({ [k]: [m] })) ? 'publicado' : 'alterado';
    }
    const ids = new Set(rascunho[k].map((m) => m.id));
    for (const m of publicado[k]) if (!ids.has(m.id)) removidos.push(m.nome);
  }
  const mudou = removidos.length > 0 || Object.values(situacao).some((s) => s !== 'publicado');
  return { situacao, removidos, mudou };
}

export function novoId(prefixo: string): string {
  const aleatorio = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefixo}-${aleatorio.slice(0, 8)}`;
}
