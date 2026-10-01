import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { DocumentDef } from '../src/document';
import { pacienteVazio, valores, type Contexto } from '../src/patient';
import { gerarDocumento, gerarLote } from '../src/render';
import { preencher, quebrarLinhas } from '../src/render/fill';
import { A4, folhasNecessarias } from '../src/render/sheet';
import { paraWinAnsi } from '../src/render/text';

const form = (nome: string) => readFileSync(new URL(`../public/forms/${nome}`, import.meta.url));

function ctx(over: Partial<Contexto['paciente']> = {}, extra: Contexto['extra'] = {}): Contexto {
  return {
    paciente: { ...pacienteVazio(), nome: 'José da Conceição', registro: '123456', dataNascimento: '1950-07-14', ...over },
    hospital: { tipo: 'HUB', nome: '' },
    data: new Date('2026-10-01T10:00:00-03:00'),
    extra,
  };
}

/** PDF sintético com campos já preenchidos, como o receituário SES do espelho. */
async function pdfComCamposSujos(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([400, 300]);
  const f = pdf.getForm();
  const nome = f.createTextField('nome');
  nome.setText('Paciente Antigo');
  nome.addToPage(page, { x: 20, y: 200, width: 300, height: 20 });
  const obs = f.createTextField('obs');
  obs.setText('Receita antiga');
  obs.addToPage(page, { x: 20, y: 150, width: 300, height: 20 });
  const cb = f.createCheckBox('emergencia');
  cb.check();
  cb.addToPage(page, { x: 20, y: 100, width: 12, height: 12 });
  return pdf.save();
}

const textoCru = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

describe('preencher (acroform)', () => {
  const def: DocumentDef = {
    id: 'tcle-cirurgia-teste',
    tipo: 't',
    hospital: ['HUB'],
    title: 'teste',
    area: ['cirurgia'],
    form: 'forms/tcle-cirurgia.pdf',
    mode: 'acroform',
    copies: 1,
    perSheet: 1,
    fields: [
      { key: 'paciente.nome', name: 'Texto1', label: 'Paciente' },
      { key: 'paciente.registro', name: 'Texto2' },
      { key: 'paciente.dataNascimento.dia', name: 'Texto3' },
      { key: 'paciente.rg', name: 'Texto6', label: 'RG' },
      { key: 'extra.emergencia', name: 'Caixa de verificação23', checkbox: true },
    ],
  };

  it('preenche o PDF oficial, achata e lista os vazios', async () => {
    const { pdf, vazios } = await preencher(def, form('tcle-cirurgia.pdf'), valores(ctx()));
    expect(vazios).toEqual([{ key: 'paciente.rg', label: 'RG' }]);
    expect(pdf.getForm().getFields()).toHaveLength(0);
    expect(pdf.getPageCount()).toBe(2);
  });

  it('limpa valores pré-salvos no PDF antes de preencher', async () => {
    const d: DocumentDef = {
      ...def,
      fields: [
        { key: 'paciente.nome', name: 'nome' },
        { key: 'extra.emergencia', name: 'emergencia', checkbox: true },
      ],
    };
    const { pdf } = await preencher(d, await pdfComCamposSujos(), valores(ctx({ nome: 'Novo' })));
    const txt = textoCru(await pdf.save({ useObjectStreams: false }));
    expect(txt).not.toContain('Paciente Antigo');
    expect(txt).not.toContain('Receita antiga');
  });

  it('acusa key desconhecida e campo inexistente', async () => {
    await expect(
      preencher({ ...def, fields: [{ key: 'paciente.nomee', name: 'Texto1' }] }, form('tcle-cirurgia.pdf'), valores(ctx())),
    ).rejects.toThrow(/chave desconhecida/);
    await expect(
      preencher({ ...def, fields: [{ key: 'paciente.nome', name: 'NaoExiste' }] }, form('tcle-cirurgia.pdf'), valores(ctx())),
    ).rejects.toThrow();
  });

  it('extra não respondido conta como vazio, sem erro', async () => {
    const { vazios } = await preencher(
      { ...def, fields: [{ key: 'extra.dias', name: 'Texto1', label: 'Dias' }] },
      form('tcle-cirurgia.pdf'),
      valores(ctx()),
    );
    expect(vazios).toEqual([{ key: 'extra.dias', label: 'Dias' }]);
  });

  it('destacar vazios funciona em widget AcroForm', async () => {
    const { vazios } = await preencher(def, form('tcle-cirurgia.pdf'), valores(ctx()), { destacarVazios: true });
    expect(vazios).toHaveLength(1);
  });
});

describe('preencher (overlay)', () => {
  const def: DocumentDef = {
    id: 'hemocentro-teste',
    tipo: 't',
    hospital: ['SES'],
    title: 'teste',
    area: ['clinica'],
    form: 'forms/requisicao-transfusao-hemocentro.pdf',
    mode: 'overlay',
    copies: 1,
    perSheet: 1,
    fields: [
      { key: 'paciente.nome', page: 0, x: 150, y: 700, size: 9, maxWidth: 50 },
      { key: 'paciente.leito', page: 0, x: 500, y: 760, label: 'Leito' },
      { key: 'paciente.sexo', page: 0, x: 300, y: 650, checkbox: true, marcarSe: 'M' },
    ],
  };

  it('desenha texto sobre PDF sem AcroForm e lista os vazios', async () => {
    const { pdf, vazios } = await preencher(def, form('requisicao-transfusao-hemocentro.pdf'), valores(ctx({ sexo: 'M' })));
    expect(vazios).toEqual([{ key: 'paciente.leito', label: 'Leito' }]);
    expect(pdf.getPageCount()).toBe(2);
  });

  it('destaca vazios; página inexistente é erro', async () => {
    await preencher(def, form('requisicao-transfusao-hemocentro.pdf'), valores(ctx()), { destacarVazios: true });
    await expect(
      preencher(
        { ...def, fields: [{ key: 'paciente.nome', page: 5, x: 0, y: 0 }] },
        form('requisicao-transfusao-hemocentro.pdf'),
        valores(ctx()),
      ),
    ).rejects.toThrow(/página 5/);
  });

  it('campos com name num PDF sem AcroForm é erro', async () => {
    await expect(
      preencher({ ...def, fields: [{ key: 'paciente.nome', name: 'x' }] }, form('requisicao-transfusao-hemocentro.pdf'), valores(ctx())),
    ).rejects.toThrow(/não tem AcroForm/);
  });
});

describe('juntar meias folhas no lote', () => {
  const gerar = async (id: string, extra: Contexto['extra'] = {}) => {
    const { documentos } = await import('../src/registry');
    const def = documentos.find((d) => d.id === id)!;
    return gerarDocumento(def, { ...ctx(), extra }, readFileSync(new URL(`../public/${def.form}`, import.meta.url)));
  };
  const paginas = async (bytes: Uint8Array) => {
    const pdf = await PDFDocument.load(bytes);
    return pdf.getPages().map((p) => {
      const { width, height } = p.getSize();
      return width > height ? 'deitada' : 'em pé';
    });
  };

  it('atestado (A5 em pé) + exames (A5 deitada) = 1 folha em pé, em vez de 2', async () => {
    const lote = [await gerar('atestado-hub', { dias: '2' }), await gerar('exames-hub', { exames: 'X' })];
    expect(await paginas(await gerarLote(lote))).toHaveLength(2);
    expect(await paginas(await gerarLote(lote, { juntarMeias: true }))).toEqual(['em pé']);
  });

  it('retorno (metade de cima da A4) também é meia folha', async () => {
    const lote = [await gerar('retorno-hub', { cartoes: [{ clinica: 'X', data: '2026-10-20', hora: '08:00' }] }), await gerar('exames-hub')];
    expect(await paginas(await gerarLote(lote, { juntarMeias: true }))).toEqual(['em pé']);
  });

  it('dois atestados (A5 em pé) ficam lado a lado numa A4 deitada', async () => {
    const lote = [await gerar('atestado-hub'), await gerar('atestado-hub')];
    expect(await paginas(await gerarLote(lote, { juntarMeias: true }))).toEqual(['deitada']);
  });

  it('folhas inteiras ficam como estão; as meias entram no lugar da primeira meia folha', async () => {
    const receita = await gerar('receituario-hub');
    const lote = [receita, await gerar('atestado-hub'), await gerar('tcle-cirurgia'), await gerar('exames-hub')];
    // receita (1, deitada) + [atestado+exames] (1, em pé) + TCLE (2, em pé)
    expect(await paginas(await gerarLote(lote, { juntarMeias: true }))).toEqual(['deitada', 'em pé', 'em pé', 'em pé']);
    const { contarFolhas } = await import('../src/render');
    expect(contarFolhas(lote, true)).toBe(4);
    expect(contarFolhas(lote, false)).toBe(5);
  });
});

describe('folhas', () => {
  const base = {
    tipo: 't',
    hospital: ['HUB'] as DocumentDef['hospital'],
    title: 'x',
    area: ['geral'] as DocumentDef['area'],
    form: '',
    mode: 'acroform' as const,
  };

  it('vias embutidas na folha reduzem o número de folhas', () => {
    expect(folhasNecessarias({ copies: 2, viasNaFolha: 2 })).toBe(1);
    expect(folhasNecessarias({ copies: 2 })).toBe(2);
    expect(folhasNecessarias({ copies: 3, viasNaFolha: 2 })).toBe(2);
    expect(folhasNecessarias({ copies: 1, viasNaFolha: 4 })).toBe(1);
  });

  it('copies = 2 duplica as páginas', async () => {
    const def: DocumentDef = { ...base, id: 'x', copies: 2, perSheet: 1, fields: [{ key: 'paciente.nome', name: 'Texto1' }] };
    const g = await gerarDocumento(def, ctx(), form('tcle-cirurgia.pdf'));
    expect(g.pdf.getPageCount()).toBe(4);
  });

  it('perSheet 2 põe dois A5 numa A4 deitada', async () => {
    const def: DocumentDef = { ...base, id: 'at', copies: 2, perSheet: 2, fields: [{ key: 'paciente.nome', name: 'untitled1' }] };
    const g = await gerarDocumento(def, ctx(), form('atestado-hub.pdf'));
    expect(g.pdf.getPageCount()).toBe(1);
    const { width, height } = g.pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(A4.h, 1);
    expect(height).toBeCloseTo(A4.w, 1);
  });

  it('perSheet 2 com meia folha deitada (A5 paisagem) empilha numa A4 em pé', async () => {
    const def: DocumentDef = { ...base, id: 'ex', copies: 2, perSheet: 2, fields: [{ key: 'paciente.nome', name: 'untitled8' }] };
    const g = await gerarDocumento(def, ctx(), form('requisicao-exames-hub.pdf'));
    expect(g.pdf.getPageCount()).toBe(1);
    const { width, height } = g.pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(A4.w, 1);
    expect(height).toBeCloseTo(A4.h, 1);
  });

  it('caixa AcroForm marcada vira um "X" desenhado (não depende da fonte ZapfDingbats)', async () => {
    const def: DocumentDef = {
      ...base,
      id: 'cb',
      copies: 1,
      perSheet: 1,
      pages: [0],
      fields: [{ key: 'paciente.sexo', name: '7', checkbox: true, marcarSe: 'F' }],
    };
    const semMarca = await (await gerarDocumento(def, ctx({ sexo: 'M' }), form('requisicao-transfusao-hub.pdf'))).pdf.save();
    const comMarca = await (await gerarDocumento(def, ctx({ sexo: 'F' }), form('requisicao-transfusao-hub.pdf'))).pdf.save();
    expect(comMarca.length).toBeGreaterThan(semMarca.length);
  });

  it('escolhe páginas e junta documentos num lote', async () => {
    const def: DocumentDef = { ...base, id: 'hub', copies: 1, perSheet: 1, pages: [0], fields: [{ key: 'paciente.nome', name: 'Text9' }] };
    const a = await gerarDocumento(def, ctx(), form('requisicao-transfusao-hub.pdf'));
    expect(a.pdf.getPageCount()).toBe(1);
    const b = await gerarDocumento({ ...def, pages: undefined }, ctx(), form('requisicao-transfusao-hub.pdf'));
    const lote = await PDFDocument.load(await gerarLote([a, b]));
    expect(lote.getPageCount()).toBe(3);
  });
});

describe('texto', () => {
  it('quebra por palavras dentro da largura e respeita quebras do usuário', async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const linhas = quebrarLinhas('um dois três quatro cinco seis sete oito\nnove', 80, font, 10);
    expect(linhas.length).toBeGreaterThan(2);
    expect(linhas.at(-1)).toBe('nove');
    for (const l of linhas) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(80);
  });

  it('mantém acentos e troca o que a Helvetica não codifica', async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(paraWinAnsi('Conceição, ácido, 1º', font)).toBe('Conceição, ácido, 1º');
    expect(paraWinAnsi('Hb ≥ 7 → ok \u{1F642}', font)).toBe('Hb >= 7 -> ok ?');
    expect(paraWinAnsi('a\r\nb', font)).toBe('a\nb');
  });
});
