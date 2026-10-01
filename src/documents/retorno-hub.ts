import type { CampoOverlay, DocumentDef } from '../document';
import { dois, parseIsoData } from '../patient';

/**
 * Marcação de consulta (HUB): scan com 8 cartões por A4 (2 colunas × 4). Overlay.
 * Usamos só a metade de cima (4 cartões); a de baixo é coberta de branco.
 * Coordenadas medidas no cartão de cima à esquerda; os outros são deslocamentos fixos
 * (o scan é uniforme: 284 pt na horizontal, 207,8 pt na vertical). "Dr." fica para o carimbo.
 * O texto fica dentro do retângulo de cada linha, ~6 pt acima da borda de baixo (bordas:
 * Clínica 804→780, Marcada 755→730, Nome 730→706, Matrícula 706→682), sem seguir a linha de
 * base dos rótulos impressos.
 */
const DX = 284;
const DY = -207.8;
const MAX_VIAS = 4;
/** Entre o rótulo "HUB" da 2ª fileira (~432 pt) e a borda da 3ª (~413 pt). */
const CORTE_Y = 424;

function cartao(i: number): CampoOverlay[] {
  const dx = (i % 2) * DX;
  const dy = Math.floor(i / 2) * DY;
  const se = `doc.via${i + 1}`;
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
    c('extra.clinica', 50, 786, { maxWidth: 232, label: 'Clínica' }),
    c('doc.dia', 78, 733, { label: 'Data da consulta' }),
    c('doc.mes', 104, 733, { label: 'Data da consulta' }),
    c('doc.ano', 127, 733, { label: 'Data da consulta' }),
    c('extra.hora', 172, 733, { label: 'Hora' }),
    c('paciente.nome', 50, 712, { maxWidth: 232, label: 'Nome' }),
    c('paciente.registro', 59, 688, { maxWidth: 222, label: 'Matrícula (registro)' }),
  ];
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
  extraInputs: [
    { key: 'clinica', label: 'Clínica / ambulatório', type: 'text' },
    { key: 'dataConsulta', label: 'Data da consulta', type: 'date' },
    { key: 'hora', label: 'Hora', type: 'text', placeholder: 'hh:mm' },
    { key: 'vias', label: 'Quantos cartões preencher (1 a 4)', type: 'number', padrao: '1' },
  ],
  calcular: (v) => {
    const d = parseIsoData(v['extra.dataConsulta'] ?? '');
    const vias = Math.min(MAX_VIAS, Math.max(1, Number(v['extra.vias']) || 1));
    const out: Record<string, string> = {
      'doc.dia': d ? dois(d.dia) : '',
      'doc.mes': d ? dois(d.mes) : '',
      'doc.ano': d ? String(d.ano) : '',
    };
    for (let i = 1; i <= MAX_VIAS; i++) out[`doc.via${i}`] = i <= vias ? 'true' : '';
    return out;
  },
  fields: Array.from({ length: MAX_VIAS }, (_, i) => cartao(i)).flat(),
};
