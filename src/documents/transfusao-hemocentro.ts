import type { CampoOverlay, DocumentDef } from '../document';
import { calcularTransfusao, extrasTransfusao } from './_transfusao';

/**
 * Requisição de transfusão do Hemocentro (SES): PDF de texto, sem campos. Coordenadas tiradas
 * das posições dos rótulos impressos. A metade de baixo é do serviço de hemoterapia.
 */
const T = 9;
const c = (key: string, x: number, y: number, extra: Partial<CampoOverlay> = {}): CampoOverlay => ({
  key,
  page: 0,
  x,
  y,
  size: T,
  ...extra,
});
const x = (key: string, xx: number, y: number, marcarSe?: string): CampoOverlay =>
  c(key, xx, y, { checkbox: true, marcarSe, size: 10 });

export const doc: DocumentDef = {
  id: 'transfusao-hemocentro',
  tipo: 'reserva-sangue',
  hospital: ['SES'],
  title: 'Requisição de transfusão — Hemocentro (SES)',
  area: ['clinica', 'cirurgia'],
  form: 'forms/requisicao-transfusao-hemocentro.pdf',
  mode: 'overlay',
  copies: 1,
  perSheet: 1,
  extraInputs: extrasTransfusao(['inr', 'sangria', 'tipoSangramento', 'sangramento']),
  calcular: calcularTransfusao,
  fields: [
    c('hospital.nome', 73, 761, { maxWidth: 108, label: 'Hospital' }),
    c('hoje.dia', 214, 761),
    c('hoje.mes', 242, 761),
    c('hoje.ano', 268, 761),
    c('paciente.clinica', 337, 761, { maxWidth: 155, opcional: true }),
    c('paciente.leito', 524, 761, { maxWidth: 45, opcional: true }),
    c('paciente.nome', 156, 740, { maxWidth: 335, label: 'Nome' }),
    c('doc.idade', 525, 740, { maxWidth: 45, opcional: true }),
    c('paciente.registro', 66, 721, { maxWidth: 95, label: 'Nº SES (registro)' }),
    c('paciente.dataNascimento.dia', 189, 721, { opcional: true }),
    c('paciente.dataNascimento.mes', 214, 721, { opcional: true }),
    c('paciente.dataNascimento.ano', 241, 721, { opcional: true }),
    c('paciente.peso', 293, 721, { maxWidth: 28, opcional: true }),
    x('paciente.sexo', 383.3, 719, 'M'),
    x('paciente.sexo', 406.8, 719, 'F'),
    c('paciente.diagnostico', 90, 698, { maxWidth: 480, label: 'Diagnóstico' }),
    c('extra.indicacao', 157, 677, { maxWidth: 415, label: 'Indicação' }),
    x('extra.transfusaoPrevia', 361.5, 655.5, 'Não'),
    x('extra.transfusaoPrevia', 396, 655.5, 'Sim'),
    x('extra.transfusaoPrevia', 430, 655.5, 'Ignorado'),
    x('extra.reacaoPrevia', 387, 634.4, 'Não'),
    x('extra.reacaoPrevia', 421.5, 634.4, 'Sim'),
    c('extra.tipoReacao', 478, 634.5, { maxWidth: 95, opcional: true }),
    // modalidade
    x('doc.modalidade', 32, 595.5, 'Programada'),
    x('doc.modalidade', 32, 581.6, 'Rotina (até 24h)'),
    x('doc.modalidade', 32, 563.8, 'Urgência (até 3h)'),
    x('doc.modalidade', 32, 548, 'Emergência'),
    x('doc.modalidade', 34.5, 532.1, 'Reserva para procedimento'),
    c('doc.diaT', 151, 597, { size: 8, se: 'doc.prog', label: 'Data programada' }),
    c('doc.mesT', 175, 597, { size: 8, se: 'doc.prog', label: 'Data programada' }),
    c('doc.anoT', 198, 597, { size: 8, se: 'doc.prog', label: 'Data programada' }),
    c('extra.horaTransfusao', 247, 597.4, { size: 8, se: 'doc.prog', opcional: true }),
    c('doc.diaT', 206, 533.5, { size: 8, se: 'doc.res', label: 'Data da cirurgia' }),
    c('doc.mesT', 230, 533.5, { size: 8, se: 'doc.res', label: 'Data da cirurgia' }),
    c('doc.anoT', 253, 533.5, { size: 8, se: 'doc.res', label: 'Data da cirurgia' }),
    // resultados laboratoriais
    c('extra.hb', 329, 597.4, { maxWidth: 32, opcional: true }),
    c('extra.ht', 409, 597.4, { maxWidth: 28, opcional: true }),
    c('extra.plaquetasLab', 500, 597.4, { maxWidth: 24, opcional: true }),
    c('extra.tp', 330, 581.6, { maxWidth: 54, opcional: true }),
    c('extra.ttpa', 413, 581.6, { maxWidth: 34, opcional: true }),
    c('extra.fibrinogenio', 508, 581.6, { maxWidth: 36, opcional: true }),
    // hemocomponentes (coluna QUANTIDADE)
    c('extra.ch', 470, 541.7, { maxWidth: 90, opcional: true }),
    c('extra.cp', 470, 516.6, { maxWidth: 90, opcional: true }),
    c('extra.pfc', 470, 495.4, { maxWidth: 90, opcional: true }),
    c('extra.crio', 470, 470.2, { maxWidth: 90, opcional: true }),
    c('extra.aferese', 470, 446.9, { maxWidth: 90, opcional: true }),
    c('extra.outros', 470, 425.8, { maxWidth: 90, opcional: true }),
    // procedimentos especiais
    x('extra.irradiado', 35.5, 490.8),
    x('extra.lavado', 103, 490.8),
    x('extra.filtrado', 162.5, 490.8),
    x('extra.fenotipado', 227.5, 490.8),
    c('extra.justificativa', 32, 451, { maxWidth: 262, linhas: 3, lineHeight: 13.5, opcional: true }),
  ],
};
