import type { CampoOverlay, DocumentDef, EntradaLista } from '../document';
import { dois, parseIsoData } from '../patient';

/**
 * Marcação de consulta (HUB): scan com 8 cartões por A4 (2 colunas × 4). Overlay.
 * Usamos só a metade de cima (4 cartões); a de baixo é coberta de branco, e essa metade de cima
 * é uma meia folha (pode dividir a A4 com outro documento na impressão).
 * Cada cartão é independente (clínica, data e hora próprias); nome e matrícula são do paciente.
 * Coordenadas medidas no cartão de cima à esquerda; os outros são deslocamentos fixos
 * (o scan é uniforme: 284 pt na horizontal, 207,8 pt na vertical). "Dr." fica para o carimbo.
 * O texto fica dentro do retângulo de cada linha, ~6 pt acima da borda de baixo (bordas:
 * Clínica 804→780, Marcada 755→730, Nome 730→706, Matrícula 706→682), sem seguir a linha de
 * base dos rótulos impressos.
 */
const DX = 284;
const DY = -207.8;
const MAX_CARTOES = 4;
/** Entre o rótulo "HUB" da 2ª fileira (~432 pt) e a borda da 3ª (~413 pt). */
const CORTE_Y = 424;

function cartao(i: number): CampoOverlay[] {
  const dx = (i % 2) * DX;
  const dy = Math.floor(i / 2) * DY;
  const n = i + 1;
  const se = `doc.c${n}`;
  const c = (key: string, x: number, y: number, extra: Partial<CampoOverlay> = {}): CampoOverlay => ({
    key,
    page: 0,
    x: x + dx,
    y: Math.round((y + dy) * 10) / 10,
    size: 10,
    se,
    ...extra,
  });
  return [
    c(`doc.c${n}.clinica`, 50, 786, { maxWidth: 232, label: `Cartão ${n}: clínica` }),
    c(`doc.c${n}.dia`, 78, 733, { label: `Cartão ${n}: data` }),
    c(`doc.c${n}.mes`, 104, 733, { label: `Cartão ${n}: data` }),
    c(`doc.c${n}.ano`, 127, 733, { label: `Cartão ${n}: data` }),
    c(`doc.c${n}.hora`, 172, 733, { label: `Cartão ${n}: hora` }),
    c('paciente.nome', 50, 712, { maxWidth: 232, label: 'Nome' }),
    c('paciente.registro', 59, 688, { maxWidth: 222, label: 'Matrícula (registro)' }),
  ];
}

export function cartoes(v: unknown): EntradaLista[] {
  return Array.isArray(v) ? (v as EntradaLista[]).slice(0, MAX_CARTOES) : [];
}

export const doc: DocumentDef = {
  id: 'retorno-hub',
  tipo: 'retorno',
  hospital: ['HUB'],
  title: 'Retorno — marcação de consulta (HUB)',
  area: ['geral'],
  form: 'forms/marcacao-consulta-hub.pdf',
  mode: 'overlay',
  copies: 1,
  perSheet: 1,
  mascaras: [{ page: 0, x: 0, y: 0, width: 596, height: CORTE_Y }],
  meiaFolha: { page: 0, x: 0, y: CORTE_Y, width: 596, height: 843 - CORTE_Y },
  extraInputs: [
    {
      key: 'cartoes',
      label: 'Cartões de retorno',
      type: 'lista',
      rotuloItem: 'Cartão',
      min: 1,
      max: MAX_CARTOES,
      campos: [
        { key: 'clinica', label: 'Clínica / ambulatório', type: 'text' },
        { key: 'data', label: 'Data da consulta', type: 'date' },
        { key: 'hora', label: 'Hora', type: 'text', placeholder: 'hh:mm' },
      ],
      ajuda: 'Cada cartão é uma consulta diferente. Nome e matrícula saem em todos.',
    },
  ],
  calcular: (_v, ctx) => {
    const lista = cartoes(ctx.extra.cartoes);
    const out: Record<string, string> = {};
    for (let i = 1; i <= MAX_CARTOES; i++) {
      const c = lista[i - 1];
      const d = parseIsoData(c?.data ?? '');
      out[`doc.c${i}`] = c ? 'true' : '';
      out[`doc.c${i}.clinica`] = c?.clinica?.trim() ?? '';
      out[`doc.c${i}.dia`] = d ? dois(d.dia) : '';
      out[`doc.c${i}.mes`] = d ? dois(d.mes) : '';
      out[`doc.c${i}.ano`] = d ? String(d.ano) : '';
      out[`doc.c${i}.hora`] = c?.hora?.trim() ?? '';
    }
    return out;
  },
  fields: Array.from({ length: MAX_CARTOES }, (_, i) => cartao(i)).flat(),
};
