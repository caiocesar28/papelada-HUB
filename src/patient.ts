/**
 * Modelo do paciente: campos comuns a todos os documentos.
 *
 * Tudo é string ('' = não preenchido) para que o formulário da tela seja trivial e para que
 * campos vazios sejam detectáveis na pré-visualização. Nada aqui é persistido: o objeto vive
 * só na memória da aba.
 */

import type { ValorExtra } from './document';

export type Sexo = 'M' | 'F' | '';

export interface Paciente {
  nome: string;
  /** Prontuário / registro HUB. */
  registro: string;
  /** aaaa-mm-dd (valor de <input type="date">). */
  dataNascimento: string;
  sexo: Sexo;
  rg: string;
  orgaoExpedidor: string;
  uf: string;
  cpf: string;
  cartaoSus: string;
  nomeMae: string;
  telefone: string;
  endereco: string;
  municipio: string;
  cep: string;
  clinica: string;
  enfermaria: string;
  leito: string;
  /** kg, como digitado. */
  peso: string;
  diagnostico: string;
  cid: string;
  procedimento: string;
}

/** Rótulos dos campos do paciente, na ordem em que aparecem na tela. */
export const ROTULOS_PACIENTE: Record<keyof Paciente, string> = {
  nome: 'Nome',
  registro: 'Registro (prontuário)',
  dataNascimento: 'Data de nascimento',
  sexo: 'Sexo',
  rg: 'RG',
  orgaoExpedidor: 'Órgão expedidor',
  uf: 'UF',
  cpf: 'CPF',
  cartaoSus: 'Cartão SUS',
  nomeMae: 'Nome da mãe ou responsável',
  telefone: 'Telefone',
  endereco: 'Endereço',
  municipio: 'Município',
  cep: 'CEP',
  clinica: 'Clínica',
  enfermaria: 'Enfermaria',
  leito: 'Leito',
  peso: 'Peso (kg)',
  diagnostico: 'Diagnóstico',
  cid: 'CID',
  procedimento: 'Procedimento',
};

export type TipoHospital = 'HUB' | 'SES';

export interface Hospital {
  tipo: TipoHospital;
  /** Nome digitado quando SES (unidade de saúde). */
  nome: string;
}

/**
 * Tudo o que um documento pode usar para se preencher. Não há dados do médico: nome e CRM
 * saem no carimbo.
 */
export interface Contexto {
  paciente: Paciente;
  hospital: Hospital;
  /** Data do documento (padrão: hoje). */
  data: Date;
  /** Valores dos extraInputs do documento, por key. */
  extra: Record<string, ValorExtra>;
}

export function pacienteVazio(): Paciente {
  return {
    nome: '',
    registro: '',
    dataNascimento: '',
    sexo: '',
    rg: '',
    orgaoExpedidor: '',
    uf: '',
    cpf: '',
    cartaoSus: '',
    nomeMae: '',
    telefone: '',
    endereco: '',
    municipio: '',
    cep: '',
    clinica: '',
    enfermaria: '',
    leito: '',
    peso: '',
    diagnostico: '',
    cid: '',
    procedimento: '',
  };
}

export function hospitalPadrao(): Hospital {
  return { tipo: 'HUB', nome: '' };
}

// ---------------------------------------------------------------------------
// Datas (dd/mm/aaaa, fuso America/Sao_Paulo)

export const FUSO = 'America/Sao_Paulo';

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export interface DataPartes {
  dia: number;
  mes: number; // 1-12
  ano: number;
}

/** Dia/mês/ano de um instante no fuso de Brasília. */
export function partesNoFuso(d: Date): DataPartes {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { dia: get('day'), mes: get('month'), ano: get('year') };
}

/** Hora (hh:mm) de um instante no fuso de Brasília. */
export function horaNoFuso(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(d);
}

/** Meio-dia em Brasília do dia dado: um instante sem ambiguidade de fuso para a data do documento. */
export function dataDoDia(p: DataPartes): Date {
  return new Date(`${p.ano}-${dois(p.mes)}-${dois(p.dia)}T12:00:00-03:00`);
}

export function paraIso(p: DataPartes): string {
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`;
}

/** 'aaaa-mm-dd' → partes, sem passar por Date (evita erro de fuso). */
export function parseIsoData(iso: string): DataPartes | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) return null;
  return { dia, mes, ano };
}

export function formatarData(p: DataPartes): string {
  return `${dois(p.dia)}/${dois(p.mes)}/${p.ano}`;
}

export function dois(n: number): string {
  return String(n).padStart(2, '0');
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Idade completa entre o nascimento e a data de referência. */
export function idade(nasc: DataPartes, ref: DataPartes): { anos: number; meses: number; dias: number } | null {
  let anos = ref.ano - nasc.ano;
  let meses = ref.mes - nasc.mes;
  let dias = ref.dia - nasc.dia;
  if (dias < 0) {
    meses -= 1;
    // dias do mês anterior ao de referência
    const mesAnt = ref.mes === 1 ? 12 : ref.mes - 1;
    const anoAnt = ref.mes === 1 ? ref.ano - 1 : ref.ano;
    dias += diasNoMes(anoAnt, mesAnt);
  }
  if (meses < 0) {
    anos -= 1;
    meses += 12;
  }
  if (anos < 0) return null;
  return { anos, meses, dias };
}

/** "34 anos", "5 meses", "12 dias". */
export function formatarIdade(i: { anos: number; meses: number; dias: number }): string {
  if (i.anos >= 1) return `${i.anos} ${i.anos === 1 ? 'ano' : 'anos'}`;
  if (i.meses >= 1) return `${i.meses} ${i.meses === 1 ? 'mês' : 'meses'}`;
  return `${i.dias} ${i.dias === 1 ? 'dia' : 'dias'}`;
}

// ---------------------------------------------------------------------------
// Valores planos usados pelos campos dos documentos

/**
 * Achata o contexto em chaves pontuadas ('paciente.nome', 'hoje.dia', 'extra.dias'...).
 * É o vocabulário que os `fields` dos documentos referenciam (mais o que `calcular` devolver).
 */
export function valores(ctx: Contexto): Record<string, string> {
  const { paciente: p } = ctx;
  const v: Record<string, string> = {};

  for (const [k, val] of Object.entries(p)) v[`paciente.${k}`] = val.trim();
  v['hospital.nome'] = ctx.hospital.tipo === 'HUB' ? 'HUB' : ctx.hospital.nome.trim();

  const hoje = partesNoFuso(ctx.data);
  v['hoje'] = formatarData(hoje);
  v['hoje.dia'] = dois(hoje.dia);
  v['hoje.mes'] = dois(hoje.mes);
  v['hoje.mesExtenso'] = MESES[hoje.mes - 1];
  v['hoje.ano'] = String(hoje.ano);
  v['hoje.ano2'] = String(hoje.ano).slice(-2);
  v['hoje.hora'] = horaNoFuso(ctx.data);
  [v['hoje.hora.h'], v['hoje.hora.min']] = v['hoje.hora'].split(':');
  v['hoje.extenso'] = `${dois(hoje.dia)} de ${MESES[hoje.mes - 1]} de ${hoje.ano}`;

  const dn = parseIsoData(p.dataNascimento);
  v['paciente.dataNascimento'] = dn ? formatarData(dn) : '';
  v['paciente.dataNascimento.dia'] = dn ? dois(dn.dia) : '';
  v['paciente.dataNascimento.mes'] = dn ? dois(dn.mes) : '';
  v['paciente.dataNascimento.ano'] = dn ? String(dn.ano) : '';
  v['paciente.dataNascimento.ano2'] = dn ? String(dn.ano).slice(-2) : '';
  const i = dn ? idade(dn, hoje) : null;
  v['paciente.idade'] = i ? formatarIdade(i) : '';
  v['paciente.idade.anos'] = i ? String(i.anos) : '';

  for (const [k, val] of Object.entries(ctx.extra)) {
    if (typeof val === 'boolean') v[`extra.${k}`] = val ? 'true' : '';
    else if (typeof val === 'string') v[`extra.${k}`] = val.trim();
    // listas (itens de receita) não viram texto aqui: o documento as monta em `calcular`.
  }
  return v;
}
