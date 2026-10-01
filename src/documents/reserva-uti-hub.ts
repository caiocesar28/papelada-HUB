import type { CampoOverlay, DocumentDef } from '../document';
import { dois, parseIsoData } from '../patient';

/**
 * Formulário de reserva de leito UTI (HUB): PDF de texto, sem campos. Coordenadas tiradas das
 * posições dos rótulos impressos (o texto começa logo depois de cada rótulo, na mesma linha de
 * base). Recebimento e confirmação do leito ficam para a gestão de leitos.
 */
const SIM_NAO = ['', 'Sim', 'Não'];

/** X dentro do "( )" de Sim ou de Não, conforme o valor do extra. */
function simNao(key: string, xSim: number, xNao: number, y: number): CampoOverlay[] {
  return [
    { key, page: 0, x: xSim, y, size: 10, checkbox: true, marcarSe: 'Sim' },
    { key, page: 0, x: xNao, y, size: 10, checkbox: true, marcarSe: 'Não' },
  ];
}

export const doc: DocumentDef = {
  id: 'reserva-uti-hub',
  tipo: 'reserva-uti',
  hospital: ['HUB'],
  title: 'Reserva de leito UTI — HUB',
  area: ['clinica', 'cirurgia'],
  form: 'forms/reserva-uti-hub.pdf',
  mode: 'overlay',
  copies: 1,
  perSheet: 1,
  extraInputs: [
    { key: 'especialidade', label: 'Especialidade', type: 'text' },
    { key: 'telefone', label: 'Telefone para contato (médico)', type: 'text' },
    { key: 'dataUti', label: 'Data programada para internação na UTI', type: 'date' },
    { key: 'justificativa', label: 'Justificativa para reserva de leito', type: 'textarea' },
    { key: 'observacoes', label: 'Observações (quadro clínico)', type: 'textarea' },
    { key: 'ventilacao', label: 'Ventilação mecânica', type: 'select', opcoes: SIM_NAO },
    { key: 'dialise', label: 'Suporte dialítico', type: 'select', opcoes: SIM_NAO },
    { key: 'isolamento', label: 'Isolamento', type: 'select', opcoes: SIM_NAO },
    { key: 'oxigenio', label: 'Oxigenoterapia', type: 'select', opcoes: SIM_NAO },
    { key: 'ar', label: 'Ar comprimido', type: 'select', opcoes: SIM_NAO },
  ],
  calcular: (v) => {
    const d = parseIsoData(v['extra.dataUti'] ?? '');
    return {
      'doc.utiDia': d ? dois(d.dia) : '',
      'doc.utiMes': d ? dois(d.mes) : '',
      'doc.utiAno': d ? String(d.ano) : '',
    };
  },
  fields: [
    { key: 'hoje.dia', page: 0, x: 180, y: 557.5, size: 10 },
    { key: 'hoje.mes', page: 0, x: 211, y: 557.5, size: 10 },
    { key: 'hoje.ano', page: 0, x: 241, y: 557.5, size: 10 },
    { key: 'hoje.hora', page: 0, x: 382, y: 557.5, size: 10, opcional: true },
    { key: 'paciente.nome', page: 0, x: 173, y: 535, size: 10, maxWidth: 390, label: 'Nome' },
    { key: 'paciente.registro', page: 0, x: 142, y: 510, size: 10, maxWidth: 145, label: 'Registro' },
    { key: 'extra.especialidade', page: 0, x: 359, y: 510, size: 10, maxWidth: 205, label: 'Especialidade' },
    { key: 'paciente.diagnostico', page: 0, x: 143, y: 487, size: 10, maxWidth: 420, label: 'Diagnóstico' },
    { key: 'extra.telefone', page: 0, x: 232, y: 441, size: 10, maxWidth: 330, opcional: true },
    { key: 'paciente.procedimento', page: 0, x: 262, y: 418, size: 10, maxWidth: 300, opcional: true },
    { key: 'doc.utiDia', page: 0, x: 277, y: 395, size: 10, opcional: true },
    { key: 'doc.utiMes', page: 0, x: 308, y: 395, size: 10, opcional: true },
    { key: 'doc.utiAno', page: 0, x: 339, y: 395, size: 10, opcional: true },
    {
      key: 'extra.justificativa',
      page: 0,
      x: 88,
      y: 357,
      size: 10,
      maxWidth: 470,
      linhas: 2,
      lineHeight: 18,
      label: 'Justificativa',
    },
    { key: 'extra.observacoes', page: 0, x: 88, y: 303, size: 10, maxWidth: 470, linhas: 2, lineHeight: 18, opcional: true },
    ...simNao('extra.ventilacao', 207.5, 254.5, 227.7),
    ...simNao('extra.dialise', 402, 452, 227.7),
    ...simNao('extra.isolamento', 164.3, 217, 210.2),
    ...simNao('extra.oxigenio', 400.3, 450.5, 210.2),
    ...simNao('extra.ar', 179.9, 226.9, 192.7),
  ],
};
