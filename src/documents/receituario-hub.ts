import type { DocumentDef } from '../document';
import { calcularReceita, extrasReceita } from './_receita';

/** Receituário HUB: A4 deitada com duas vias lado a lado (AcroForm). */
export const doc: DocumentDef = {
  id: 'receituario-hub',
  tipo: 'receituario',
  hospital: ['HUB'],
  title: 'Receituário — HUB',
  area: ['geral'],
  form: 'forms/receituario-comum-hub.pdf',
  mode: 'acroform',
  copies: 2,
  viasNaFolha: 2,
  perSheet: 1,
  extraInputs: extrasReceita,
  calcular: (v, ctx) => calcularReceita(v, ctx.extra),
  fields: [
    // via esquerda
    { key: 'paciente.nome', name: 'untitled1', size: 10, label: 'Nome' },
    { key: 'paciente.registro', name: 'untitled2', size: 10, label: 'Registro' },
    { key: 'hoje.dia', name: 'untitled8' },
    { key: 'hoje.mes', name: 'untitled9' },
    { key: 'hoje.ano', name: 'untitled10' },
    { key: 'doc.corpo', name: 'untitled11', size: 10, label: 'Itens da receita' },
    // via direita
    { key: 'paciente.nome', name: 'untitled3', size: 10, label: 'Nome' },
    { key: 'paciente.registro', name: 'untitled4', size: 10, label: 'Registro' },
    { key: 'hoje.dia', name: 'untitled5' },
    { key: 'hoje.mes', name: 'untitled6' },
    { key: 'hoje.ano', name: 'untitled7' },
    { key: 'doc.corpo', name: 'untitled12', size: 10, label: 'Itens da receita' },
  ],
};
