import type { DocumentDef } from '../document';

/**
 * TCLE Transfusão de Hemocomponentes e Hemoderivados (HUB). Só identificação, diagnóstico e
 * datas; o corpo do termo vem intacto do PDF. Obrigatórios: nome e prontuário. Médico/CRM e as
 * caixas de declaração do médico ficam para preencher à mão/carimbo.
 */
export const doc: DocumentDef = {
  id: 'tcle-transfusao',
  tipo: 'tcle-transfusao',
  hospital: ['HUB'],
  title: 'TCLE — Transfusão',
  area: ['clinica', 'cirurgia'],
  form: 'forms/tcle-transfusao.pdf',
  mode: 'acroform',
  copies: 1,
  perSheet: 1,
  extraInputs: [
    { key: 'emergencia', label: 'Situação de emergência (sem esclarecimento amplo)', type: 'checkbox' },
    { key: 'respNome', label: 'Responsável legal: nome', type: 'text' },
    { key: 'respParentesco', label: 'Responsável: parentesco', type: 'text' },
    { key: 'respRg', label: 'Responsável: RG', type: 'text' },
    { key: 'respCpf', label: 'Responsável: CPF', type: 'text' },
  ],
  calcular: (v) => ({
    'doc.normal': v['extra.emergencia'] ? '' : 'true',
    'doc.emergencia': v['extra.emergencia'] ?? '',
  }),
  fields: [
    { key: 'paciente.nome', name: 'Texto1', label: 'Nome' },
    { key: 'paciente.registro', name: 'Texto2', label: 'Prontuário' },
    { key: 'paciente.dataNascimento.dia', name: 'Texto3', label: 'Data de nascimento', opcional: true },
    { key: 'paciente.dataNascimento.mes', name: 'Texto4', label: 'Data de nascimento', opcional: true },
    { key: 'paciente.dataNascimento.ano', name: 'Texto5', label: 'Data de nascimento', opcional: true },
    { key: 'paciente.rg', name: 'Texto6', label: 'RG', opcional: true },
    { key: 'paciente.orgaoExpedidor', name: 'Texto7', label: 'Órgão expedidor', opcional: true },
    { key: 'paciente.uf', name: 'Texto8', label: 'UF', opcional: true },
    { key: 'paciente.diagnostico', name: 'Texto11', label: 'Diagnóstico', opcional: true },
    // assinatura do paciente (não há em emergência)
    { key: 'hoje.dia', name: 'Texto12', se: 'doc.normal' },
    { key: 'hoje.mesExtenso', name: 'Texto13', se: 'doc.normal' },
    { key: 'hoje.ano', name: 'Texto14', se: 'doc.normal' },
    { key: 'extra.respNome', name: 'Texto15', opcional: true },
    { key: 'extra.respParentesco', name: 'Texto16', opcional: true },
    { key: 'extra.respRg', name: 'Texto17', opcional: true },
    { key: 'extra.respCpf', name: 'Texto18', opcional: true },
    // declaração do médico: data do bloco correspondente
    { key: 'hoje.dia', name: 'Texto21', se: 'doc.normal' },
    { key: 'hoje.mesExtenso', name: 'Texto22', se: 'doc.normal' },
    { key: 'hoje.ano', name: 'Texto23', se: 'doc.normal' },
    { key: 'hoje.dia', name: 'Texto24', se: 'doc.emergencia' },
    { key: 'hoje.mesExtenso', name: 'Texto25', se: 'doc.emergencia' },
    { key: 'hoje.ano', name: 'Texto26', se: 'doc.emergencia' },
  ],
};
