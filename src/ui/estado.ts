/**
 * Estado da tela. Dados do paciente vivem só na memória da aba (princípio 1): nada vai para
 * localStorage. Os modelos vêm do repositório (src/presets/modelos.json).
 */
import type { DocumentDef, ItemReceita, ValorExtra } from '../document';
import { PUBLICADOS, type Modelos } from '../modelos';
import {
  dataDoDia,
  hospitalPadrao,
  pacienteVazio,
  paraIso,
  parseIsoData,
  partesNoFuso,
  type Contexto,
  type Hospital,
  type Paciente,
} from '../patient';
import { varianteDe } from '../registry';
import { TIPOS } from '../tipos';

export type ItemMarcavel = ItemReceita & { marcado: boolean };

export interface Estado {
  hospital: Hospital;
  paciente: Paciente;
  /** Data do documento, aaaa-mm-dd. */
  dataIso: string;
  /** Tipos marcados (ids de TIPOS). */
  selecionados: Set<string>;
  /** Respostas dos extraInputs, por tipo (compartilhadas entre variantes HUB/SES). */
  extras: Record<string, Record<string, ValorExtra>>;
  /** Listas de receita editáveis, por tipo e key: todos os itens, com marcação e textos. */
  receitas: Record<string, Record<string, ItemMarcavel[]>>;
  /** Modelo de receita aplicado, por '<tipo>.<key>'. */
  modeloReceita: Record<string, string>;
  /** Modelos publicados no repositório. */
  modelos: Modelos;
  /** Tipo cuja aba está aberta. */
  aba: string | null;
}

export function estadoInicial(modelos: Modelos = PUBLICADOS): Estado {
  return {
    hospital: hospitalPadrao(),
    paciente: pacienteVazio(),
    dataIso: paraIso(partesNoFuso(new Date())),
    selecionados: new Set(),
    extras: {},
    receitas: {},
    modeloReceita: {},
    modelos,
    aba: null,
  };
}

/** Troca a lista de itens de uma receita pelos itens do modelo (marcados conforme `padrao`). */
export function aplicarModeloReceita(e: Estado, tipo: string, key: string, modeloId: string): void {
  const m = e.modelos.receitas.find((r) => r.id === modeloId) ?? e.modelos.receitas[0];
  (e.receitas[tipo] ??= {})[key] = (m?.itens ?? []).map((i) => ({ ...i, marcado: i.padrao === true }));
  if (m) e.modeloReceita[`${tipo}.${key}`] = m.id;
}

/** Preenche diagnóstico, procedimento e os campos abertos do termo com um modelo de TCLE. */
export function aplicarModeloTcle(e: Estado, tipo: string, modeloId: string): void {
  const m = e.modelos.tcles.find((t) => t.id === modeloId && t.termo === tipo);
  if (!m) return;
  e.paciente.diagnostico = m.diagnostico;
  e.paciente.procedimento = m.procedimento;
  const extras = (e.extras[tipo] ??= {});
  extras.dispositivos = m.dispositivos;
  extras.complicacoes = m.complicacoes;
}

/** Documentos marcados que existem no hospital escolhido, na ordem de TIPOS. */
export function documentosAtivos(e: Estado): DocumentDef[] {
  return TIPOS.filter((t) => e.selecionados.has(t.id))
    .map((t) => varianteDe(t.id, e.hospital.tipo))
    .filter((d): d is DocumentDef => d !== undefined);
}

/** Garante valores iniciais dos extraInputs de um tipo (na primeira vez que é marcado). */
export function iniciarExtras(e: Estado, def: DocumentDef): void {
  const extras = (e.extras[def.tipo] ??= {});
  const receitas = (e.receitas[def.tipo] ??= {});
  for (const inp of def.extraInputs ?? []) {
    if (inp.type === 'receita') {
      if (!receitas[inp.key]) aplicarModeloReceita(e, def.tipo, inp.key, inp.modeloPadrao ?? '');
    } else if (!(inp.key in extras)) {
      extras[inp.key] = inp.padrao ?? (inp.type === 'checkbox' ? false : '');
    }
  }
}

export function contexto(e: Estado, def: DocumentDef): Contexto {
  const extra: Record<string, ValorExtra> = { ...(e.extras[def.tipo] ?? {}) };
  for (const [key, itens] of Object.entries(e.receitas[def.tipo] ?? {})) {
    extra[key] = itens.filter((i) => i.marcado).map(({ marcado: _m, ...item }) => item);
  }
  const dia = parseIsoData(e.dataIso);
  return {
    paciente: e.paciente,
    hospital: e.hospital,
    data: dia ? dataDoDia(dia) : new Date(),
    extra,
  };
}

/**
 * Campos do paciente que os documentos ativos usam, além de nome e registro (sempre na tela).
 * 'paciente.dataNascimento.dia' conta como 'dataNascimento'.
 */
export function camposPacienteUsados(defs: DocumentDef[]): Array<keyof Paciente> {
  const usados = new Set<string>();
  for (const d of defs) {
    for (const c of d.fields) {
      const m = /^paciente\.([a-zA-Z]+)/.exec(c.key);
      if (m) usados.add(m[1]);
    }
  }
  usados.delete('nome');
  usados.delete('registro');
  return [...usados] as Array<keyof Paciente>;
}

/** O campo do paciente é cobrado (não opcional) por algum dos documentos? */
export function campoObrigatorio(defs: DocumentDef[], k: keyof Paciente): boolean {
  const re = new RegExp(`^paciente\\.${k}(\\.|$)`);
  return defs.some((d) => d.fields.some((c) => re.test(c.key) && !c.opcional));
}
