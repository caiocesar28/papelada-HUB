import type { DocumentDef } from '../document';
import { extrasParecer } from './_parecer';

/**
 * Pedido de parecer (SES): scan com campos AcroForm numerados de 1 a 10. Os campos 6 (data de
 * nascimento) e 10 (data) são "caixinhas" de um caractere e embaralham datas: ficam vazios e as
 * datas saem por sobreposição em cada coluna.
 */
export const doc: DocumentDef = {
  id: 'parecer-ses',
  tipo: 'parecer',
  hospital: ['SES'],
  title: 'Pedido de parecer — SES',
  area: ['geral'],
  form: 'forms/parecer-ses.pdf',
  mode: 'acroform',
  copies: 1,
  perSheet: 1,
  extraInputs: extrasParecer,
  calcular: (v) => ({ 'doc.inicial': v['paciente.nome'].charAt(0).toUpperCase() }),
  fields: [
    { key: 'hospital.nome', name: '1', size: 10, label: 'Unidade de saúde' },
    { key: 'paciente.enfermaria', name: '2', size: 10, opcional: true },
    { key: 'paciente.leito', name: '3', size: 10, opcional: true },
    // "Dígito terminal" = prontuário SES
    { key: 'paciente.registro', name: '4', size: 10, label: 'Registro' },
    { key: 'doc.inicial', name: '5', size: 12, opcional: true },
    { key: 'paciente.dataNascimento.dia', page: 0, x: 430, y: 779, size: 10, opcional: true },
    { key: 'paciente.dataNascimento.mes', page: 0, x: 472, y: 779, size: 10, opcional: true },
    { key: 'paciente.dataNascimento.ano', page: 0, x: 503, y: 779, size: 9, opcional: true },
    { key: 'paciente.nome', name: '7', size: 11, label: 'Nome' },
    { key: 'extra.clinicaDestino', name: '8', size: 11, label: 'Para a clínica' },
    { key: 'extra.motivo', name: '9', size: 11, label: 'Motivo da consulta' },
    { key: 'hoje.dia', page: 0, x: 106, y: 405, size: 11 },
    { key: 'hoje.mes', page: 0, x: 145, y: 405, size: 11 },
    { key: 'hoje.ano', page: 0, x: 185, y: 405, size: 11 },
  ],
};
