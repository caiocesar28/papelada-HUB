import type { CampoAcroform, DocumentDef } from '../document';
import { calcularTransfusao, extrasTransfusao } from './_transfusao';

/**
 * Requisição de transfusão (HUB), usada também para reserva de sangue. AcroForm na frente; o
 * verso (termo de responsabilidade para transfusão de emergência) é preenchido à mão. Exige o
 * TCLE de transfusão junto.
 */
const marca = (key: string, name: string, marcarSe: string): CampoAcroform => ({ key, name, checkbox: true, marcarSe });

export const doc: DocumentDef = {
  id: 'transfusao-hub',
  tipo: 'reserva-sangue',
  hospital: ['HUB'],
  title: 'Requisição de transfusão / reserva de sangue — HUB',
  area: ['clinica', 'cirurgia'],
  form: 'forms/requisicao-transfusao-hub.pdf',
  mode: 'acroform',
  copies: 1,
  perSheet: 1,
  extraInputs: extrasTransfusao(['tp', 'outros', 'justificativa']),
  calcular: calcularTransfusao,
  fields: [
    // características da transfusão
    marca('doc.modalidade', '1', 'Programada'),
    marca('doc.modalidade', '3', 'Rotina (até 24h)'),
    marca('doc.modalidade', '5', 'Urgência (até 3h)'),
    marca('doc.modalidade', '2', 'Reserva para procedimento'),
    marca('doc.modalidade', '4', 'Emergência'),
    { key: 'doc.diaT', name: 'Text1', size: 8, se: 'doc.prog', label: 'Data programada' },
    { key: 'doc.mesT', name: 'Text2', size: 8, se: 'doc.prog', label: 'Data programada' },
    { key: 'doc.anoT2', name: 'Text3', size: 8, se: 'doc.prog', label: 'Data programada' },
    { key: 'extra.horaTransfusao', name: 'Text4', size: 8, se: 'doc.prog', opcional: true },
    { key: 'doc.diaT', name: 'Text5', size: 8, se: 'doc.res', label: 'Data do procedimento' },
    { key: 'doc.mesT', name: 'Text6', size: 8, se: 'doc.res', label: 'Data do procedimento' },
    { key: 'doc.anoT2', name: 'Text7', size: 8, se: 'doc.res', label: 'Data do procedimento' },
    // identificação / diagnóstico / indicação
    { key: 'paciente.cartaoSus', name: 'Text8', size: 9, opcional: true },
    { key: 'paciente.nome', name: 'Text9', size: 9, label: 'Nome' },
    marca('paciente.sexo', '6', 'M'),
    marca('paciente.sexo', '7', 'F'),
    { key: 'paciente.dataNascimento.dia', name: 'Text10', size: 8, opcional: true },
    { key: 'paciente.dataNascimento.mes', name: 'Text12', size: 8, opcional: true },
    { key: 'paciente.dataNascimento.ano', name: 'Text13', size: 6.5, opcional: true },
    { key: 'doc.idade', name: 'Text14', size: 8, opcional: true },
    { key: 'paciente.peso', name: 'Text15', size: 8, opcional: true },
    { key: 'paciente.registro', name: 'Text16', size: 8, label: 'Registro' },
    { key: 'doc.enfLeito', name: 'Text17', size: 7, opcional: true },
    { key: 'paciente.diagnostico', name: 'Text19', size: 9, label: 'Diagnóstico' },
    { key: 'extra.indicacao', name: 'Text20', size: 9, label: 'Indicação / procedimento' },
    { key: 'paciente.cid', name: 'Text21', size: 9, opcional: true },
    // antecedentes / exames
    marca('extra.transfusaoPrevia', '8', 'Sim'),
    marca('extra.transfusaoPrevia', '9', 'Não'),
    marca('extra.transfusaoPrevia', '10', 'Ignorado'),
    marca('extra.reacaoPrevia', '11', 'Sim'),
    marca('extra.reacaoPrevia', '12', 'Não'),
    marca('extra.reacaoPrevia', '13', 'Ignorado'),
    { key: 'extra.tipoReacao', name: 'Text27', size: 8, opcional: true },
    { key: 'extra.ht', name: 'Text29', size: 8, opcional: true },
    { key: 'extra.hb', name: 'Text30', size: 8, opcional: true },
    { key: 'extra.plaquetasLab', name: 'Text31', size: 8, opcional: true },
    { key: 'extra.fibrinogenio', name: 'Text32', size: 8, opcional: true },
    { key: 'extra.ttpa', name: 'Text33', size: 8, opcional: true },
    { key: 'extra.inr', name: 'Text34', size: 8, opcional: true },
    marca('extra.sangramento', '22', 'Não'),
    marca('extra.sangramento', '23', 'Sim'),
    { key: 'extra.tipoSangramento', name: 'Text35', size: 8, opcional: true },
    // hemocomponentes solicitados
    { key: 'extra.ch', name: 'Text36', size: 9, opcional: true },
    { key: 'extra.pfc', name: 'Text37', size: 9, opcional: true },
    { key: 'extra.crio', name: 'Text38', size: 9, opcional: true },
    { key: 'extra.cp', name: 'Text39', size: 9, opcional: true },
    { key: 'extra.aferese', name: 'Text40', size: 9, opcional: true },
    { key: 'extra.sangria', name: 'Text41', size: 9, opcional: true },
    { key: 'extra.sangria', name: '16', checkbox: true },
    { key: 'extra.fenotipado', name: '18', checkbox: true },
    { key: 'extra.lavado', name: '19', checkbox: true },
    { key: 'extra.filtrado', name: '20', checkbox: true },
    { key: 'extra.irradiado', name: '21', checkbox: true },
    // data e hora do pedido (nome/CRM no carimbo)
    { key: 'hoje.dia', name: 'Text42', size: 8 },
    { key: 'hoje.mes', name: 'Text43', size: 8 },
    { key: 'hoje.ano2', name: 'Text44', size: 8 },
    { key: 'hoje.hora.h', name: 'Text45', size: 8 },
    { key: 'hoje.hora.min', name: 'Text46', size: 8 },
  ],
};
