/** Tipos de documento mostrados na seleção, na ordem da tela. */
export const TIPOS: Array<{ id: string; titulo: string; descricao: string }> = [
  { id: 'receituario', titulo: 'Sintomáticos (receita)', descricao: 'Itens do modelo, com quantidade para os dias de tratamento' },
  { id: 'atestado', titulo: 'Atestado', descricao: 'Dias de afastamento, CID opcional' },
  { id: 'retorno', titulo: 'Retorno', descricao: 'Marcação de consulta, até 4 cartões' },
  { id: 'tcle-cirurgia', titulo: 'TCLE cirurgia', descricao: 'Identificação e modelo por procedimento' },
];
