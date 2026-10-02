import type { DocumentDef } from '../document';

/**
 * Papel timbrado HUB/EBSERH (relatório, declaração, encaminhamento em texto livre). O PDF vem
 * do .doc do espelho (tools/papel-timbrado.ts) e tem as 2 páginas do modelo: a 1ª com SUS e
 * "Governo Federal", a 2ª só com UnB/HUB, EBSERH e MEC. Imprime a 2ª (logos atuais).
 * O texto é todo do usuário; a fonte diminui se não couber numa página.
 * Assinatura e carimbo ficam à mão abaixo da data.
 */
const X = 57; // margem esquerda de 2 cm
const LARGURA = 481; // até antes da faixa verde da direita

export const doc: DocumentDef = {
  id: 'papel-timbrado-hub',
  tipo: 'papel-timbrado',
  hospital: ['HUB'],
  title: 'Papel timbrado — HUB',
  area: ['geral'],
  form: 'forms/papel-timbrado-hub.pdf',
  mode: 'overlay',
  copies: 1,
  perSheet: 1,
  pages: [1],
  extraInputs: [
    { key: 'titulo', label: 'Título', type: 'text', placeholder: 'Ex.: RELATÓRIO MÉDICO (opcional)' },
    { key: 'identificar', label: 'Identificar o paciente (nome e prontuário) no topo', type: 'checkbox', padrao: true },
    { key: 'texto', label: 'Texto', type: 'textarea', ajuda: 'Quebras de linha são mantidas. Se não couber, a fonte diminui.' },
    { key: 'local', label: 'Local', type: 'text', padrao: 'Brasília' },
  ],
  calcular: (v) => {
    const local = v['extra.local'];
    // marcado por padrão: só desmarcado explicitamente ('') tira a identificação
    const identificar = v['extra.identificar'] === '' ? '' : 'true';
    return {
      'doc.identificar': identificar,
      'doc.rotuloNome': identificar && 'Paciente:',
      'doc.rotuloRegistro': identificar && 'Prontuário:',
      'doc.localData': local ? `${local}, ${v['hoje.extenso']}.` : v['hoje.extenso'],
    };
  },
  fields: [
    { key: 'extra.titulo', page: 1, x: X, y: 730, size: 13, maxWidth: LARGURA, opcional: true },
    { key: 'doc.rotuloNome', page: 1, x: X, y: 706, size: 10, opcional: true },
    { key: 'paciente.nome', page: 1, x: X + 46, y: 706, size: 10, maxWidth: 300, se: 'doc.identificar', label: 'Nome' },
    { key: 'doc.rotuloRegistro', page: 1, x: 418, y: 706, size: 10, opcional: true },
    { key: 'paciente.registro', page: 1, x: 472, y: 706, size: 10, maxWidth: 66, se: 'doc.identificar', label: 'Prontuário' },
    { key: 'extra.texto', page: 1, x: X, y: 680, size: 11, maxWidth: LARGURA, linhas: 37, label: 'Texto' },
    { key: 'doc.localData', page: 1, x: 300, y: 165, size: 11, maxWidth: 238 },
  ],
};
