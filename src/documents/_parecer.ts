import type { ExtraInput } from '../document';

/** Comuns às variantes do pedido de parecer (mesmas keys em HUB e SES). */
export const extrasParecer: ExtraInput[] = [
  { key: 'clinicaDestino', label: 'Para a clínica (especialidade)', type: 'text', placeholder: 'Ex.: Cardiologia' },
  {
    key: 'motivo',
    label: 'Motivo da consulta',
    type: 'textarea',
    ajuda: 'Dados sobre os quais deseja opinião e principais sintomas do paciente.',
  },
];
