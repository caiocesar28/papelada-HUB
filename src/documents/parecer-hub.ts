import type { DocumentDef } from '../document';
import { extrasParecer } from './_parecer';

/**
 * Solicitação de parecer (HUB): scan com campos AcroForm. ENF. e LEITO não têm campo e saem
 * por sobreposição. A parte de baixo (parecer) é do médico consultado.
 */
export const doc: DocumentDef = {
  id: 'parecer-hub',
  tipo: 'parecer',
  hospital: ['HUB'],
  title: 'Pedido de parecer — HUB',
  area: ['geral'],
  form: 'forms/parecer-hub.pdf',
  mode: 'acroform',
  copies: 1,
  perSheet: 1,
  extraInputs: extrasParecer,
  fields: [
    { key: 'paciente.nome', name: 'text1_pdil', size: 10, label: 'Nome' },
    { key: 'paciente.registro', name: 'text2_5db5', size: 10, label: 'Registro' },
    { key: 'paciente.clinica', name: 'text4_i78m', size: 10, opcional: true },
    { key: 'extra.clinicaDestino', name: 'text3_vlbs', size: 10, label: 'Para a clínica' },
    { key: 'extra.motivo', name: 'text5_lgwp', size: 10, label: 'Motivo da consulta' },
    { key: 'hoje', name: 'text6_1cko', size: 10 },
    { key: 'paciente.enfermaria', page: 0, x: 403, y: 726, size: 10, maxWidth: 57, opcional: true },
    { key: 'paciente.leito', page: 0, x: 467, y: 726, size: 10, maxWidth: 85, opcional: true },
  ],
};
