import type { CampoAcroform, DocumentDef } from '../document';
import { DIAS_PADRAO, calcularReceita } from './_receita';

/**
 * Receituário de controle especial (HUB e SES usam o mesmo layout): A4 deitada com 1ª via
 * (farmácia) e 2ª via (paciente). Começa sem modelo: escolha um modelo de controlados ou use
 * "Item avulso". Identificação do comprador/fornecedor fica para a farmácia.
 */
export function receituarioEspecial(hospital: 'HUB' | 'SES', form: string): DocumentDef {
  const via = (nome: string, reg: string, end: string, corpo: string, data: string): CampoAcroform[] => [
    { key: 'paciente.nome', name: nome, label: 'Nome' },
    { key: 'paciente.registro', name: reg, label: 'Registro' },
    { key: 'paciente.endereco', name: end, label: 'Endereço' },
    { key: 'doc.corpo', name: corpo, size: 10, label: 'Itens da receita' },
    { key: 'hoje', name: data, size: 11 },
  ];
  return {
    id: `receituario-especial-${hospital.toLowerCase()}`,
    tipo: 'receituario-especial',
    hospital: [hospital],
    title: `Receituário especial — ${hospital}`,
    area: ['geral'],
    form,
    mode: 'acroform',
    copies: 2,
    viasNaFolha: 2,
    perSheet: 1,
    extraInputs: [
      { key: 'dias', label: 'Dias de tratamento', type: 'number', padrao: DIAS_PADRAO },
      {
        key: 'itens',
        label: 'Itens da receita',
        type: 'receita',
        ajuda: 'Escolha um modelo (crie modelos de controlados em Modelos) ou adicione um item avulso.',
      },
    ],
    calcular: (v, ctx) => calcularReceita(v, ctx.extra),
    fields: [...via('Text1', 'Text2', 'Text3', 'Text4', 'Text5'), ...via('Text6', 'Text7', 'Text8', 'Text9', 'Text10')],
  };
}
