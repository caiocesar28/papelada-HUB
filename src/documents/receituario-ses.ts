import type { DocumentDef } from '../document';
import { calcularReceita, extrasReceita } from './_receita';

/**
 * Receituário SES: A4 deitada com duas vias (AcroForm). O PDF em public/forms é a cópia
 * limpa e descriptografada do original (ver forms.manifest.json).
 */
export const doc: DocumentDef = {
  id: 'receituario-ses',
  tipo: 'receituario',
  hospital: ['SES'],
  title: 'Receituário — SES',
  area: ['geral'],
  form: 'forms/receituario-comum-ses.pdf',
  mode: 'acroform',
  copies: 2,
  viasNaFolha: 2,
  perSheet: 1,
  extraInputs: extrasReceita,
  calcular: (v, ctx) => calcularReceita(v, ctx.extra),
  fields: [
    // via esquerda
    { key: 'paciente.nome', name: 'Text7', label: 'Nome' },
    { key: 'paciente.registro', name: 'Text8', label: 'Registro' },
    { key: 'hospital.nome', name: 'Text9', label: 'Unidade de saúde' },
    { key: 'paciente.clinica', name: 'Text10', opcional: true },
    { key: 'hoje', name: 'Text12', size: 12 },
    { key: 'doc.corpo', name: 'Text19', size: 10, label: 'Itens da receita' },
    // via direita
    { key: 'paciente.nome', name: 'Text18', label: 'Nome' },
    { key: 'paciente.registro', name: 'Text17', label: 'Registro' },
    { key: 'hospital.nome', name: 'Text15', label: 'Unidade de saúde' },
    { key: 'paciente.clinica', name: 'Text16', opcional: true },
    { key: 'hoje', name: 'Text13', size: 12 },
    { key: 'doc.corpo', name: 'Text20', size: 10, label: 'Itens da receita' },
  ],
};
