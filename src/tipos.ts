/** Tipos de documento mostrados na seleção, na ordem da tela. */
export const TIPOS: Array<{ id: string; titulo: string; descricao: string }> = [
  { id: 'receituario', titulo: 'Sintomáticos (receita)', descricao: 'Itens do modelo, com quantidade e posologia' },
  { id: 'receituario-especial', titulo: 'Receituário especial', descricao: 'Controle especial, 2 vias (farmácia e paciente)' },
  { id: 'atestado', titulo: 'Atestado', descricao: 'Dias de afastamento, CID opcional' },
  { id: 'retorno', titulo: 'Retorno', descricao: 'Marcação de consulta, até 4 cartões' },
  { id: 'parecer', titulo: 'Pedido de parecer', descricao: 'Encaminhamento para outra clínica' },
  { id: 'exames', titulo: 'Requisição de exames', descricao: 'Exames pedidos, meia folha' },
  { id: 'reserva-sangue', titulo: 'Reserva de sangue', descricao: 'Requisição de transfusão / reserva para procedimento' },
  { id: 'tcle-cirurgia', titulo: 'TCLE cirurgia', descricao: 'Identificação e modelo por procedimento' },
  { id: 'tcle-transfusao', titulo: 'TCLE transfusão', descricao: 'Identificação; texto do termo intacto' },
  { id: 'reserva-uti', titulo: 'Reserva de leito UTI', descricao: 'Vaga de urgência/emergência ou pós-operatória' },
];
