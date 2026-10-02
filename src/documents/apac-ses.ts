import type { CampoOverlay, DocumentDef } from '../document';
import { MAX_SECUNDARIOS, calcularApac, extrasApac } from './_apac';

/**
 * APAC — laudo para solicitação/autorização de procedimento ambulatorial (modelo SUS da SES).
 * PDF de texto com alguns campos AcroForm; o resto sai por sobreposição. Códigos de
 * procedimento têm 10 caixas (uma por dígito), medidas no formulário. 2 vias.
 * Raça/cor, etnia, responsável e as partes de autorização/executante ficam à mão.
 */
const CODIGO = [32.4, 50.5, 68.5, 86.5, 104.5, 122.5, 140.5, 158.5, 176.5, 194.5, 211.4];
const CEP = [469.8, 481.8, 493.0, 504.2, 515.5, 526.6, 538.6, 549.8, 562.0];
/** Linha de base dos códigos/nomes: principal (campo no PDF para o nome) e os 5 secundários. */
const Y_LINHA = [538, 494, 467.6, 441.2, 414.8, 388.4];

const ov = (key: string, x: number, y: number, extra: Partial<CampoOverlay> = {}): CampoOverlay => ({
  key,
  page: 0,
  x,
  y,
  size: 10,
  ...extra,
});

function secundario(i: number): CampoOverlay[] {
  const se = `doc.s${i}`;
  const y = Y_LINHA[i];
  return [
    ov(`doc.s${i}.cod`, 0, y, { celulas: CODIGO, soDigitos: true, se, label: `Secundário ${i}: procedimento` }),
    ov(`doc.s${i}.nome`, 219, y, { size: 8, maxWidth: 296, se, opcional: true }),
    ov(`doc.s${i}.qtde`, 527, y, { maxWidth: 30, se, opcional: true }),
  ];
}

export const doc: DocumentDef = {
  id: 'apac-ses',
  tipo: 'apac',
  hospital: ['SES'],
  title: 'APAC — laudo de procedimento ambulatorial (SES)',
  area: ['geral'],
  form: 'forms/apac-ses.pdf',
  mode: 'acroform',
  copies: 2,
  perSheet: 1,
  extraInputs: extrasApac,
  calcular: calcularApac,
  fields: [
    { key: 'hospital.nome', name: 'ESTABELECIMENTO', size: 10, label: 'Estabelecimento' },
    // paciente
    { key: 'paciente.nome', name: '3 - NOME DO PACIENTE', size: 10, label: 'Nome' },
    { key: 'paciente.sexo', name: 'Mas', checkbox: true, marcarSe: 'M' },
    { key: 'paciente.sexo', name: 'Fem', checkbox: true, marcarSe: 'F' },
    { key: 'paciente.registro', name: '5 - NUMERO DO PRONTUARIO', size: 10, label: 'Prontuário' },
    { key: 'doc.cns', name: 'CNS PCTE', size: 10, label: 'Cartão SUS (CNS)' },
    { key: 'paciente.dataNascimento', name: 'DN', size: 10, label: 'Data de nascimento' },
    { key: 'paciente.nomeMae', name: '9 NOME DA  MÃE', size: 10, label: 'Nome da mãe' },
    { key: 'doc.telDdd', name: 'DDD', size: 10, opcional: true },
    // o campo do número tem só 8 caixas: celular com 9 dígitos vai por sobreposição
    ov('doc.telNum', 440, 649, { size: 9, maxWidth: 120, opcional: true }),
    { key: 'paciente.endereco', name: '13 - ENDERECO', size: 10, opcional: true },
    { key: 'paciente.municipio', name: '14 - MUNICIPIO', size: 10, opcional: true },
    ov('extra.ibge', 358, 581, { maxWidth: 76, opcional: true }),
    { key: 'paciente.uf', name: 'Text15', size: 10, opcional: true },
    ov('paciente.cep', 0, 581, { celulas: CEP, soDigitos: true, size: 9, opcional: true }),
    // procedimento principal
    ov('doc.procCod', 0, Y_LINHA[0], { celulas: CODIGO, soDigitos: true, label: 'Procedimento principal' }),
    { key: 'doc.procNome', name: '19 - PROCEDIMENTO', size: 8, label: 'Procedimento principal' },
    { key: 'doc.qtde', name: 'QTDE', size: 10, label: 'Quantidade' },
    ...Array.from({ length: MAX_SECUNDARIOS }, (_, i) => secundario(i + 1)).flat(),
    // justificativa
    { key: 'paciente.diagnostico', name: 'DIAGNOSTICO', size: 9, label: 'Descrição do diagnóstico' },
    { key: 'doc.cid1', name: 'CID10', size: 11, label: 'CID-10 principal' },
    ov('doc.cid2', 402, 341, { size: 11, opcional: true }),
    ov('doc.cid3', 471, 341, { size: 11, opcional: true }),
    { key: 'extra.observacoes', name: 'OBSERVACOES', size: 9, opcional: true },
    { key: 'hoje', name: 'DATA', size: 9 },
  ],
};
