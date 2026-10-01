import type { DocumentDef } from '../document';

/**
 * Requisição de exames (HUB): A5 deitada (AcroForm); duas cabem numa A4 em pé.
 * "Requisitante" e a assinatura ficam para o carimbo.
 */
export const doc: DocumentDef = {
  id: 'exames-hub',
  tipo: 'exames',
  hospital: ['HUB'],
  title: 'Requisição de exames — HUB',
  area: ['geral'],
  form: 'forms/requisicao-exames-hub.pdf',
  mode: 'acroform',
  copies: 1,
  perSheet: 2,
  extraInputs: [
    { key: 'exames', label: 'Natureza do exame', type: 'textarea', placeholder: 'Um exame por linha' },
  ],
  fields: [
    { key: 'paciente.nome', name: 'untitled8', size: 9, label: 'Nome' },
    { key: 'paciente.dataNascimento', name: 'untitled9', size: 9, opcional: true },
    { key: 'paciente.registro', name: 'untitled10', size: 9, label: 'Prontuário' },
    { key: 'paciente.clinica', name: 'untitled12', size: 6, opcional: true },
    { key: 'paciente.enfermaria', name: 'untitled13', size: 8, opcional: true },
    { key: 'paciente.leito', name: 'untitled14', size: 8, opcional: true },
    { key: 'extra.exames', name: 'untitled4', size: 9, label: 'Natureza do exame' },
    { key: 'hoje.dia', name: 'untitled15', size: 9 },
    { key: 'hoje.mes', name: 'untitled16', size: 9 },
    { key: 'hoje.ano', name: 'untitled17', size: 8 },
  ],
};
