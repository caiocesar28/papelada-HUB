import type { CampoOverlay, DocumentDef } from '../document';
import { MAX_SECUNDARIOS, calcularApac, extrasApac } from './_apac';

/**
 * APAC — laudo para solicitação/autorização de procedimento ambulatorial (HUB). Scan com campos
 * AcroForm que não respeitam as caixinhas: CPF, CNS, CEP e códigos saem por sobreposição, um
 * caractere por caixa (divisórias medidas no scan). As caixas de código são 9 para os 10 dígitos
 * do SIGTAP: os 8 primeiros vão um por caixa e os 2 últimos (dígito verificador) juntos na 9ª.
 * Imprime só a 1ª página (a 2ª é o laudo complementar de oncologia/nefrologia). 2 vias.
 * Solicitante, autorização e executante ficam para o carimbo/regulação.
 */
const CPF = [389.0, 403.2, 417.5, 431.5, 445.8, 459.8, 473.8, 487.8, 501.8, 515.5, 529.4, 543.2];
const CNS = [158.2, 172.6, 186.9, 201.1, 215.5, 229.8, 244.0, 258.2, 272.5, 286.8, 300.8, 314.8, 329.0, 343.2, 357.5, 371.9];
const CEP = [431.8, 446.2, 460.5, 474.8, 489.0, 503.1, 517.2, 531.4, 545.5];
/** Divisórias das 9 caixas de código (medidas na linha do procedimento principal). */
const CODIGO = [55.5, 72.9, 90.0, 107.4, 124.8, 142.0, 159.5, 177.0, 194.5, 212.0];
/** 8 primeiros dígitos, um por caixa; os 2 últimos centrados na 9ª caixa. */
const CODIGO_8 = CODIGO.slice(0, 9);
const X_FIM = (CODIGO[8] + CODIGO[9]) / 2 - 5.6;
/** Linha de base dos códigos: principal e os 5 secundários. */
const Y_CODIGO = [535, 487, 461.5, 435.7, 410.5, 384.7];
/** Linhas dos nomes/quantidades dos secundários 2 a 5 (o 1º tem campo no PDF). */
const Y_NOME_SEC = [462, 436, 410, 384];

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
  const campos: CampoOverlay[] = [
    ov(`doc.s${i}.cod8`, 0, Y_CODIGO[i], { celulas: CODIGO_8, soDigitos: true, se, label: `Secundário ${i}: procedimento` }),
    ov(`doc.s${i}.codFim`, X_FIM, Y_CODIGO[i], { se, opcional: true }),
  ];
  if (i >= 2) {
    const y = Y_NOME_SEC[i - 2];
    campos.push(
      ov(`doc.s${i}.nome`, 219, y, { size: 8, maxWidth: 282, se, opcional: true }),
      ov(`doc.s${i}.qtde`, 512, y, { maxWidth: 30, se, opcional: true }),
    );
  }
  return campos;
}

export const doc: DocumentDef = {
  id: 'apac-hub',
  tipo: 'apac',
  hospital: ['HUB'],
  title: 'APAC — laudo de procedimento ambulatorial (HUB)',
  area: ['geral'],
  form: 'forms/apac-hub.pdf',
  mode: 'acroform',
  copies: 2,
  perSheet: 1,
  pages: [0],
  extraInputs: extrasApac,
  calcular: calcularApac,
  fields: [
    // identificação do paciente
    { key: 'paciente.nome', name: 'untitled1', size: 10, label: 'Nome' },
    ov('paciente.cpf', 0, 685, { celulas: CPF, soDigitos: true, opcional: true }),
    { key: 'paciente.registro', name: 'untitled3', size: 10, label: 'Prontuário' },
    ov('doc.cns', 0, 657, { celulas: CNS, soDigitos: true, label: 'Cartão SUS (CNS)' }),
    ov('paciente.dataNascimento.dia', 385, 655, { size: 9, label: 'Data de nascimento' }),
    ov('paciente.dataNascimento.mes', 412, 655, { size: 9, label: 'Data de nascimento' }),
    ov('paciente.dataNascimento.ano', 436, 655, { size: 8, label: 'Data de nascimento' }),
    { key: 'paciente.sexo', name: 'untitled23', checkbox: true, marcarSe: 'M' },
    { key: 'paciente.sexo', name: 'untitled24', checkbox: true, marcarSe: 'F' },
    { key: 'paciente.nomeMae', name: 'untitled6', size: 10, label: 'Nome da mãe ou responsável' },
    { key: 'paciente.telefone', name: 'untitled7', size: 10, opcional: true },
    { key: 'paciente.endereco', name: 'untitled8', size: 10, opcional: true },
    { key: 'paciente.municipio', name: 'untitled9', size: 10, opcional: true },
    ov('extra.ibge', 280, 580, { maxWidth: 100, opcional: true }),
    { key: 'paciente.uf', name: 'untitled10', size: 10, opcional: true },
    ov('paciente.cep', 0, 580, { celulas: CEP, soDigitos: true, opcional: true }),
    // procedimento principal
    ov('doc.procCod8', 0, Y_CODIGO[0], { celulas: CODIGO_8, soDigitos: true, label: 'Procedimento principal' }),
    ov('doc.procCodFim', X_FIM, Y_CODIGO[0], { opcional: true }),
    { key: 'doc.procNome', name: 'untitled12', size: 8, label: 'Procedimento principal' },
    { key: 'doc.qtde', name: 'untitled13', size: 10, label: 'Quantidade' },
    // secundários (o 1º tem campos de nome e quantidade no PDF)
    { key: 'doc.s1.nome', name: 'untitled14', size: 8, se: 'doc.s1', opcional: true },
    { key: 'doc.s1.qtde', name: 'untitled15', size: 10, se: 'doc.s1', opcional: true },
    ...Array.from({ length: MAX_SECUNDARIOS }, (_, i) => secundario(i + 1)).flat(),
    // justificativa
    { key: 'paciente.diagnostico', name: 'untitled16', size: 9, label: 'Descrição do diagnóstico' },
    { key: 'doc.cid1', name: 'untitled17', size: 11, label: 'CID-10 principal' },
    { key: 'doc.cid2', name: 'untitled18', size: 11, opcional: true },
    ov('doc.cid3', 457, 337, { size: 11, opcional: true }),
    { key: 'extra.observacoes', name: 'untitled19', size: 9, opcional: true },
    // data da solicitação (nome, documento e assinatura do solicitante: carimbo)
    // barras impressas em x ≈ 329 e ≈ 358
    ov('hoje.dia', 307, 197, { size: 9 }),
    ov('hoje.mes', 337, 197, { size: 9 }),
    ov('hoje.ano', 362, 197, { size: 8 }),
  ],
};
