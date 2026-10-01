import type { DocumentDef } from '../document';

/**
 * TCLE Procedimentos Cirúrgicos (HUB). Só identificação, datas e campos que o próprio termo
 * deixa em aberto; o corpo do termo vem intacto do PDF. Obrigatórios: só nome e prontuário;
 * o resto é opcional (pode ser completado à mão). Médico e CRM (item 1) e as caixas de
 * declaração do médico ficam para preencher à mão/carimbo.
 */
export const doc: DocumentDef = {
  id: 'tcle-cirurgia',
  tipo: 'tcle-cirurgia',
  hospital: ['HUB'],
  title: 'TCLE — Cirurgia',
  area: ['cirurgia'],
  form: 'forms/tcle-cirurgia.pdf',
  mode: 'acroform',
  copies: 1,
  perSheet: 1,
  extraInputs: [
    { key: 'dispositivos', label: 'Dispositivos ou estomas (item 2)', type: 'text', placeholder: 'em branco se não houver' },
    { key: 'complicacoes', label: 'Outras complicações (item 6)', type: 'textarea' },
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
    { key: 'paciente.procedimento', name: 'Texto12', label: 'Procedimento', opcional: true },
    { key: 'extra.dispositivos', name: 'Texto13', opcional: true },
    { key: 'extra.complicacoes', name: 'Texto14', size: 10, opcional: true },
    // assinatura do paciente (não há em emergência)
    { key: 'hoje.dia', name: 'Texto15', se: 'doc.normal' },
    { key: 'hoje.mesExtenso', name: 'Texto16', se: 'doc.normal' },
    { key: 'hoje.ano', name: 'Texto17', se: 'doc.normal' },
    { key: 'extra.respNome', name: 'Texto18', opcional: true },
    { key: 'extra.respParentesco', name: 'Texto19', opcional: true },
    { key: 'extra.respRg', name: 'Texto20', opcional: true },
    { key: 'extra.respCpf', name: 'Texto21', opcional: true },
    // declaração do médico: data do bloco correspondente
    { key: 'hoje.dia', name: 'Texto25', se: 'doc.normal' },
    { key: 'hoje.mesExtenso', name: 'Texto26', se: 'doc.normal' },
    { key: 'hoje.ano', name: 'Texto27', se: 'doc.normal' },
    { key: 'hoje.dia', name: 'Texto28', se: 'doc.emergencia' },
    { key: 'hoje.mesExtenso', name: 'Texto29', se: 'doc.emergencia' },
    { key: 'hoje.ano', name: 'Texto30', se: 'doc.emergencia' },
  ],
};
