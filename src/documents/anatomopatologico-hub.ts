import type { DocumentDef } from '../document';
import { dois, parseIsoData } from '../patient';

/**
 * Requisição de exame da Unidade de Anatomia Patológica (HUB): AcroForm. O bloco "Uso exclusivo
 * da UAP" e o médico requisitante (carimbo) ficam em branco. Material, resumo clínico e exame
 * solicitado são digitados: o app não sugere conteúdo clínico.
 */
export const doc: DocumentDef = {
  id: 'anatomopatologico-hub',
  tipo: 'anatomopatologico',
  hospital: ['HUB'],
  title: 'Pedido de anatomopatológico (HUB)',
  area: ['cirurgia', 'clinica', 'go'],
  form: 'forms/anatomopatologico-hub.pdf',
  mode: 'acroform',
  copies: 1,
  perSheet: 1,
  extraInputs: [
    { key: 'material', label: 'Material', type: 'text', placeholder: 'Ex.: peça cirúrgica, biópsia de…' },
    { key: 'resumo', label: 'Resumo clínico (dados importantes para a patologia)', type: 'textarea' },
    { key: 'exame', label: 'Exame solicitado', type: 'text' },
    { key: 'biopsiasAnteriores', label: 'Biópsia / citopatologia anteriores', type: 'text' },
    { key: 'numeros', label: 'Número(s) das anteriores', type: 'text' },
    { key: 'dataAnterior', label: 'Data das anteriores', type: 'date' },
    { key: 'ur', label: 'Ginecológicas: UR (última regra)', type: 'text' },
    { key: 'gesta', label: 'Gesta', type: 'text' },
    { key: 'para', label: 'Para', type: 'text' },
    { key: 'outrasGineco', label: 'Outras informações ginecológicas', type: 'text' },
    { key: 'ambulatorio', label: 'Ambulatório', type: 'text' },
    { key: 'cor', label: 'Cor', type: 'text' },
    { key: 'estadoCivil', label: 'Estado civil', type: 'text' },
    { key: 'profissao', label: 'Profissão', type: 'text' },
    { key: 'naturalidade', label: 'Naturalidade', type: 'text' },
    { key: 'observacoes', label: 'Observações', type: 'textarea' },
  ],
  calcular: (v) => {
    const tel = v['paciente.telefone'].replace(/\D/g, '');
    const d = parseIsoData(v['extra.dataAnterior'] ?? '');
    return {
      'doc.telDdd': tel.length >= 10 ? tel.slice(0, 2) : '',
      'doc.telNum': tel.length >= 10 ? `${tel.slice(2, -4)}-${tel.slice(-4)}` : v['paciente.telefone'],
      'doc.antDia': d ? dois(d.dia) : '',
      'doc.antMes': d ? dois(d.mes) : '',
      'doc.antAno': d ? String(d.ano) : '',
    };
  },
  fields: [
    { key: 'paciente.nome', name: 'untitled1', size: 10, label: 'Nome' },
    { key: 'paciente.registro', name: 'untitled2', size: 10, label: 'Prontuário' },
    { key: 'paciente.cartaoSus', name: 'untitled3', size: 10, opcional: true },
    { key: 'paciente.endereco', name: 'untitled4', size: 9, opcional: true },
    { key: 'paciente.cep', name: 'untitled5', size: 10, opcional: true },
    { key: 'doc.telDdd', name: 'untitled8', size: 9, opcional: true },
    { key: 'doc.telNum', name: 'untitled9', size: 10, opcional: true },
    { key: 'paciente.sexo', name: 'untitled10', size: 10, opcional: true },
    { key: 'paciente.idade', name: 'untitled11', size: 9, opcional: true },
    { key: 'paciente.dataNascimento.dia', name: 'untitled12', size: 9, opcional: true },
    { key: 'paciente.dataNascimento.mes', name: 'untitled13', size: 9, opcional: true },
    { key: 'paciente.dataNascimento.ano', name: 'untitled14', size: 9, opcional: true },
    { key: 'extra.cor', name: 'untitled15', size: 9, opcional: true },
    { key: 'extra.estadoCivil', name: 'untitled16', size: 9, opcional: true },
    { key: 'extra.profissao', name: 'untitled17', size: 9, opcional: true },
    { key: 'extra.naturalidade', name: 'untitled18', size: 9, opcional: true },
    { key: 'paciente.clinica', name: 'untitled19', size: 10, opcional: true },
    { key: 'paciente.leito', name: 'untitled20', size: 10, opcional: true },
    { key: 'extra.ambulatorio', name: 'untitled21', size: 10, opcional: true },
    { key: 'paciente.diagnostico', name: 'untitled22', size: 10, label: 'Diagnóstico clínico' },
    { key: 'extra.material', name: 'untitled23', size: 10, label: 'Material' },
    { key: 'extra.resumo', name: 'untitled24', size: 9, label: 'Resumo clínico' },
    { key: 'extra.biopsiasAnteriores', name: 'untitled25', size: 9, opcional: true },
    { key: 'extra.numeros', name: 'untitled26', size: 9, opcional: true },
    { key: 'doc.antDia', name: 'untitled27', size: 9, opcional: true },
    { key: 'doc.antMes', name: 'untitled28', size: 9, opcional: true },
    { key: 'doc.antAno', name: 'untitled29', size: 9, opcional: true },
    { key: 'extra.ur', name: 'untitled30', size: 9, opcional: true },
    { key: 'extra.gesta', name: 'untitled31', size: 9, opcional: true },
    { key: 'extra.para', name: 'untitled32', size: 9, opcional: true },
    { key: 'extra.outrasGineco', name: 'untitled33', size: 9, opcional: true },
    { key: 'extra.exame', name: 'untitled34', size: 10, label: 'Exame solicitado' },
    { key: 'extra.observacoes', name: 'untitled35', size: 9, opcional: true },
    { key: 'hoje.dia', name: 'untitled36', size: 9 },
    { key: 'hoje.mes', name: 'untitled37', size: 9 },
    { key: 'hoje.ano', name: 'untitled38', size: 9 },
    { key: 'hoje.hora', name: 'untitled39', size: 9 },
  ],
};
