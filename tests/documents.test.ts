import { readFileSync } from 'node:fs';
import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import manifest from '../forms.manifest.json';
import type { DocumentDef, ItemReceita } from '../src/document';
import { LINHA_EM_BRANCO, quantidade, textoReceita } from '../src/documents/_receita';
import { porExtenso } from '../src/extenso';
import { pacienteVazio, type Contexto, type TipoHospital } from '../src/patient';
import { documentos, varianteDe } from '../src/registry';
import { gerarDocumento, valoresDoDocumento } from '../src/render';
import { TIPOS } from '../src/tipos';

const bytes = (def: DocumentDef) => readFileSync(new URL(`../public/${def.form}`, import.meta.url));

const item = (over: Partial<ItemReceita>): ItemReceita => ({ id: 'x', nome: 'X', prescricao: '', posologia: '', ...over });

function ctxCompleto(hospital: TipoHospital = 'HUB'): Contexto {
  return {
    paciente: {
      ...pacienteVazio(),
      nome: 'José da Conceição Araújo',
      registro: '1234567',
      dataNascimento: '1950-07-14',
      rg: '123456',
      orgaoExpedidor: 'SSP',
      uf: 'DF',
      diagnostico: 'Diagnóstico de teste',
      procedimento: 'Procedimento de teste',
      clinica: 'Clínica médica',
    },
    hospital: { tipo: hospital, nome: hospital === 'SES' ? 'HRAN' : '' },
    data: new Date('2026-10-01T10:00:00-03:00'),
    extra: {
      itens: [item({ id: 'a', nome: 'Item A' })],
      dias: '3',
      clinica: 'Cirurgia geral',
      dataConsulta: '2026-10-20',
      hora: '08:00',
      vias: '2',
    },
  };
}

describe('registro', () => {
  it('todo documento aponta para um PDF que existe e está no manifest', () => {
    const arquivos = new Set(manifest.forms.map((f) => f.file));
    for (const d of documentos) {
      expect(arquivos.has(`public/${d.form}`), d.id).toBe(true);
      expect(() => bytes(d), d.id).not.toThrow();
    }
  });

  it('todo documento tem um tipo listado em TIPOS', () => {
    const tipos = new Set(TIPOS.map((t) => t.id));
    for (const d of documentos) expect(tipos.has(d.tipo), d.id).toBe(true);
  });

  it('acha a variante pelo hospital', () => {
    expect(varianteDe('receituario', 'HUB')?.id).toBe('receituario-hub');
    expect(varianteDe('receituario', 'SES')?.id).toBe('receituario-ses');
    expect(varianteDe('tcle-cirurgia', 'SES')).toBeUndefined();
  });

  it('variantes de um mesmo tipo usam as mesmas keys de extraInputs', () => {
    for (const t of TIPOS) {
      const keys = documentos
        .filter((d) => d.tipo === t.id)
        .map((d) => (d.extraInputs ?? []).map((e) => e.key).sort().join(','));
      expect(new Set(keys).size, t.id).toBeLessThanOrEqual(1);
    }
  });
});

describe.each(documentos.map((d) => [d.id, d] as const))('%s', (_id, def) => {
  const hospital = def.hospital[0];

  it('gera com todos os dados sem campos obrigatórios vazios', async () => {
    const g = await gerarDocumento(def, ctxCompleto(hospital), bytes(def));
    expect(g.vazios).toEqual([]);
    expect(g.pdf.getPageCount()).toBeGreaterThan(0);
  });

  it('com paciente vazio, cobra o nome', async () => {
    const ctx: Contexto = { ...ctxCompleto(hospital), paciente: pacienteVazio() };
    const g = await gerarDocumento(def, ctx, bytes(def), { destacarVazios: true });
    expect(g.vazios.map((v) => v.key)).toContain('paciente.nome');
  });
});

describe('receita', () => {
  it('usa prescrição e posologia do preset; vazio vira nome e linha em branco', () => {
    const t = textoReceita(
      [
        item({ nome: 'Dipirona' }),
        item({ nome: 'Outro', prescricao: 'Linha 1 escrita pelo usuário', posologia: 'Linha 2 escrita pelo usuário' }),
      ],
      5,
    );
    expect(t).toBe(
      `1. Dipirona\n    ${LINHA_EM_BRANCO}\n\n2. Linha 1 escrita pelo usuário\n    Linha 2 escrita pelo usuário`,
    );
  });

  it('quantidade = por dose × vezes ao dia × dias, ligada por tracejado (\\t)', () => {
    const dipirona = item({ prescricao: 'Dipirona 500 mg', posologia: 'p', porDose: 2, vezesAoDia: 4, unidade: 'comprimidos' });
    expect(quantidade(dipirona, 5)).toBe('40 comprimidos');
    expect(quantidade({ ...dipirona, porDose: 1, vezesAoDia: 1 }, 1)).toBe('1 comprimido');
    expect(quantidade({ ...dipirona, quantidade: '1 frasco' }, 5)).toBe('1 frasco');
    expect(quantidade(item({}), 5)).toBe('');
    expect(quantidade(dipirona, 0)).toBe('');
    expect(textoReceita([dipirona], 5)).toBe('1. Dipirona 500 mg\t40 comprimidos\n    p');
  });

  it('dias de tratamento vêm do extra "dias" (padrão 5)', () => {
    const def = varianteDe('receituario', 'HUB')!;
    expect(def.extraInputs?.find((i) => i.key === 'dias')?.padrao).toBe('5');
    const tenox = item({ prescricao: 'Tenoxicam 40 mg', posologia: 'x', porDose: 1, vezesAoDia: 1, unidade: 'comprimidos' });
    const v = valoresDoDocumento(def, { ...ctxCompleto(), extra: { dias: '5', itens: [tenox] } });
    expect(v['doc.corpo']).toBe('1. Tenoxicam 40 mg\t5 comprimidos\n    x');
  });

  it('sem itens marcados, o corpo é cobrado como vazio', async () => {
    const def = varianteDe('receituario', 'HUB')!;
    const ctx = ctxCompleto();
    ctx.extra.itens = [];
    const g = await gerarDocumento(def, ctx, bytes(def));
    expect(g.vazios.map((v) => v.key)).toEqual(['doc.corpo']);
  });

  it('o PDF SES em public/ não traz valores pré-salvos', async () => {
    const pdf = await PDFDocument.load(bytes(varianteDe('receituario', 'SES')!));
    const form = pdf.getForm();
    expect(form.getFields()).toHaveLength(16);
    for (const f of form.getFields()) {
      if (f instanceof PDFTextField) expect(f.getText() ?? '', f.getName()).toBe('');
      if (f instanceof PDFCheckBox) expect(f.isChecked(), f.getName()).toBe(false);
    }
  });
});

describe('atestado', () => {
  it('dias por extenso e local/data', () => {
    const def = varianteDe('atestado', 'HUB')!;
    const v = valoresDoDocumento(def, ctxCompleto());
    expect(v['doc.diasExtenso']).toBe('três');
    expect(v['doc.localData']).toBe('Brasília, 01 de outubro de 2026');
  });

  it('porExtenso', () => {
    expect(porExtenso(1)).toBe('um');
    expect(porExtenso(15)).toBe('quinze');
    expect(porExtenso(21)).toBe('vinte e um');
    expect(porExtenso(30)).toBe('trinta');
    expect(porExtenso(100)).toBe('cem');
    expect(porExtenso(120)).toBe('cento e vinte');
    expect(porExtenso(-1)).toBe('');
    expect(porExtenso(2.5)).toBe('');
  });
});

describe('retorno', () => {
  const def = varianteDe('retorno', 'HUB')!;

  it('preenche só os cartões pedidos', () => {
    const ctx = ctxCompleto();
    ctx.extra.vias = '3';
    const v = valoresDoDocumento(def, ctx);
    expect([1, 2, 3, 4].map((i) => v[`doc.via${i}`])).toEqual(['true', 'true', 'true', '']);
    expect(v['doc.via5']).toBeUndefined();
    expect(v['doc.dia']).toBe('20');
    expect(v['doc.ano']).toBe('2026');
  });

  it('só a metade de cima: 4 cartões, máscara cobre a de baixo', () => {
    expect(def.fields.every((c) => 'y' in c && c.y > 424)).toBe(true);
    expect(def.mascaras).toEqual([{ page: 0, x: 0, y: 0, width: 596, height: 424 }]);
  });

  it('vias fora da faixa ficam entre 1 e 4', () => {
    const ctx = ctxCompleto();
    ctx.extra.vias = '20';
    expect(valoresDoDocumento(def, ctx)['doc.via4']).toBe('true');
    ctx.extra.vias = '';
    const v = valoresDoDocumento(def, ctx);
    expect([v['doc.via1'], v['doc.via2']]).toEqual(['true', '']);
  });
});

describe('tcle cirurgia', () => {
  const def = varianteDe('tcle-cirurgia', 'HUB')!;
  it('só nome e prontuário são obrigatórios', async () => {
    const ctx: Contexto = {
      ...ctxCompleto(),
      paciente: { ...pacienteVazio(), nome: 'Fulano', registro: '1' },
      extra: {},
    };
    expect((await gerarDocumento(def, ctx, bytes(def))).vazios).toEqual([]);
    ctx.paciente.registro = '';
    expect((await gerarDocumento(def, ctx, bytes(def))).vazios.map((v) => v.key)).toEqual(['paciente.registro']);
  });

  it('emergência troca o bloco de data preenchido', () => {
    const ctx = ctxCompleto();
    expect(valoresDoDocumento(def, ctx)['doc.normal']).toBe('true');
    ctx.extra.emergencia = true;
    const v = valoresDoDocumento(def, ctx);
    expect(v['doc.normal']).toBe('');
    expect(v['doc.emergencia']).toBe('true');
  });
});
