import type { DocumentDef } from '../document';
import { porExtenso } from '../extenso';

/** Atestado HUB: formulário A5 (AcroForm), sai na metade de uma A4 deitada. */
export const doc: DocumentDef = {
  id: 'atestado-hub',
  tipo: 'atestado',
  hospital: ['HUB'],
  title: 'Atestado — HUB',
  area: ['geral'],
  form: 'forms/atestado-hub.pdf',
  mode: 'acroform',
  copies: 1,
  perSheet: 2,
  extraInputs: [
    { key: 'dias', label: 'Dias de afastamento', type: 'number' },
    { key: 'cid', label: 'CID (opcional)', type: 'text', ajuda: 'Só com autorização do paciente.' },
  ],
  calcular: (v) => ({
    'doc.diasExtenso': v['extra.dias'] ? porExtenso(Number(v['extra.dias'])) : '',
    'doc.localData': `Brasília, ${v['hoje.extenso']}`,
  }),
  fields: [
    { key: 'paciente.nome', name: 'untitled1', size: 11, label: 'Nome' },
    { key: 'extra.dias', name: 'untitled2', size: 11, label: 'Dias de afastamento' },
    { key: 'doc.diasExtenso', name: 'untitled3', size: 11, label: 'Dias (extenso)' },
    { key: 'extra.cid', name: 'untitled4', size: 11, opcional: true },
    { key: 'doc.localData', name: 'untitled5', size: 11 },
  ],
};
