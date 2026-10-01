import type { ExtraInput } from '../document';
import type { Contexto } from '../patient';
import { dois, parseIsoData } from '../patient';

export const MODALIDADES = ['Reserva para procedimento', 'Programada', 'Rotina (até 24h)', 'Urgência (até 3h)', 'Emergência'];

const SIM_NAO_IGN = ['', 'Não', 'Sim', 'Ignorado'];

/**
 * Entradas da reserva de sangue / requisição de transfusão. As variantes (HUB e Hemocentro)
 * usam as mesmas keys para o que têm em comum; cada uma tira o que o formulário não tem.
 * Quantidades e exames são digitados: o app não sugere hemocomponente nem dose.
 */
const TODAS: ExtraInput[] = [
  { key: 'modalidade', label: 'Modalidade', type: 'select', opcoes: MODALIDADES, padrao: MODALIDADES[0] },
  {
    key: 'dataTransfusao',
    label: 'Data do procedimento / programada',
    type: 'date',
    ajuda: 'Só para reserva e transfusão programada.',
  },
  { key: 'horaTransfusao', label: 'Hora (programada)', type: 'text', placeholder: 'hh:mm' },
  { key: 'indicacao', label: 'Indicação clínica / procedimento', type: 'text' },
  { key: 'justificativa', label: 'Justificativas e observações', type: 'textarea' },
  { key: 'ch', label: 'Concentrado de hemácias', type: 'text', placeholder: 'quantidade' },
  { key: 'cp', label: 'Concentrado de plaquetas', type: 'text', placeholder: 'quantidade' },
  { key: 'pfc', label: 'Plasma fresco congelado', type: 'text', placeholder: 'quantidade' },
  { key: 'crio', label: 'Crioprecipitado', type: 'text', placeholder: 'quantidade' },
  { key: 'aferese', label: 'Plaquetas por aférese', type: 'text', placeholder: 'quantidade' },
  { key: 'sangria', label: 'Sangria terapêutica (mL)', type: 'text' },
  { key: 'outros', label: 'Outros hemocomponentes', type: 'text' },
  { key: 'hb', label: 'Hb (g/dL)', type: 'text' },
  { key: 'ht', label: 'Ht (%)', type: 'text' },
  { key: 'plaquetasLab', label: 'Plaquetas', type: 'text' },
  { key: 'tp', label: 'TP', type: 'text' },
  { key: 'ttpa', label: 'TTPa', type: 'text' },
  { key: 'inr', label: 'INR', type: 'text' },
  { key: 'fibrinogenio', label: 'Fibrinogênio (mg/dL)', type: 'text' },
  { key: 'transfusaoPrevia', label: 'Transfusão prévia', type: 'select', opcoes: SIM_NAO_IGN },
  { key: 'reacaoPrevia', label: 'Reação transfusional prévia', type: 'select', opcoes: SIM_NAO_IGN },
  { key: 'tipoReacao', label: 'Tipo de reação', type: 'text' },
  { key: 'sangramento', label: 'Sangramento ativo', type: 'select', opcoes: ['', 'Não', 'Sim'] },
  { key: 'tipoSangramento', label: 'Tipo de sangramento', type: 'text' },
  { key: 'irradiado', label: 'Irradiado', type: 'checkbox' },
  { key: 'lavado', label: 'Lavado', type: 'checkbox' },
  { key: 'filtrado', label: 'Filtrado', type: 'checkbox' },
  { key: 'fenotipado', label: 'Fenotipado', type: 'checkbox' },
];

export function extrasTransfusao(sem: string[]): ExtraInput[] {
  return TODAS.filter((e) => !sem.includes(e.key));
}

/** Datas da modalidade (programada ou reserva), idade e enfermaria/leito. */
export function calcularTransfusao(v: Record<string, string>, _ctx: Contexto): Record<string, string> {
  const mod = v['extra.modalidade'] || MODALIDADES[0];
  const prog = mod === 'Programada';
  const res = mod === 'Reserva para procedimento';
  const d = parseIsoData(v['extra.dataTransfusao'] ?? '');
  const comData = (cond: boolean, x: string) => (cond ? x : '');
  return {
    'doc.modalidade': mod,
    'doc.prog': prog ? 'true' : '',
    'doc.res': res ? 'true' : '',
    'doc.diaT': comData(prog || res, d ? dois(d.dia) : ''),
    'doc.mesT': comData(prog || res, d ? dois(d.mes) : ''),
    'doc.anoT': comData(prog || res, d ? String(d.ano) : ''),
    'doc.anoT2': comData(prog || res, d ? String(d.ano).slice(-2) : ''),
    'doc.idade': v['paciente.idade.anos'],
    'doc.enfLeito': [v['paciente.enfermaria'], v['paciente.leito']].filter(Boolean).join(' / '),
  };
}
