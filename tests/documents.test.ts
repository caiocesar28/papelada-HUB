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
      endereco: 'Endereço de teste',
      cartaoSus: '898 0012 3456 7890',
      nomeMae: 'Mãe de teste',
      telefone: '(61) 99999-0000',
      municipio: 'Brasília',
      cep: '70.840-901',
    },
    hospital: { tipo: hospital, nome: hospital === 'SES' ? 'HRAN' : '' },
    data: new Date('2026-10-01T10:00:00-03:00'),
    extra: {
      itens: [item({ id: 'a', nome: 'Item A' })],
      dias: '3',
      cartoes: [{ clinica: 'Cirurgia geral', data: '2026-10-20', hora: '08:00' }],
      clinicaDestino: 'Cardiologia',
      motivo: 'Motivo de teste',
      exames: 'Exame de teste',
      especialidade: 'Cirurgia geral',
      justificativa: 'Justificativa de teste',
      indicacao: 'Indicação de teste',
      modalidade: 'Reserva para procedimento',
      dataTransfusao: '2026-10-05',
      procedimento: '0201010224 — BIOPSIA DE GANGLIO LINFATICO',
      cidPrincipal: 'R590 — Aumento de volume localizado de gânglios linfáticos',
      secundarios: [],
      material: 'Material de teste',
      resumo: 'Resumo de teste',
      exame: 'Exame de teste',
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

  it('variantes de um mesmo tipo: keys em comum têm o mesmo tipo de entrada (o valor é compartilhado)', () => {
    for (const t of TIPOS) {
      const tipos = new Map<string, string>();
      for (const d of documentos.filter((x) => x.tipo === t.id)) {
        for (const e of d.extraInputs ?? []) {
          const antes = tipos.get(e.key);
          if (antes) expect(e.type, `${t.id}.${e.key}`).toBe(antes);
          tipos.set(e.key, e.type);
        }
      }
    }
  });

  it('todo campo AcroForm usado existe no PDF', async () => {
    const { PDFDocument } = await import('pdf-lib');
    for (const d of documentos) {
      const pdf = await PDFDocument.load(bytes(d));
      const nomes = new Set(pdf.getForm().getFields().map((f) => f.getName()));
      for (const c of d.fields) if ('name' in c) expect(nomes.has(c.name), `${d.id}: ${c.name}`).toBe(true);
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
    );
    expect(t).toBe(
      `1. Dipirona\n    ${LINHA_EM_BRANCO}\n\n2. Linha 1 escrita pelo usuário\n    Linha 2 escrita pelo usuário`,
    );
  });

  it('quantidade é o texto digitado, sem cálculo, ligada por tracejado (\\t)', () => {
    const dipirona = item({ prescricao: 'Dipirona 500 mg', posologia: 'p', quantidade: ' 20 comprimidos ' });
    expect(quantidade(dipirona)).toBe('20 comprimidos');
    expect(quantidade(item({}))).toBe('');
    expect(textoReceita([dipirona])).toBe('1. Dipirona 500 mg\t20 comprimidos\n    p');
    expect(textoReceita([item({ prescricao: 'Sem quantidade', posologia: 'p' })])).toBe('1. Sem quantidade\n    p');
  });

  it('não há mais "dias de tratamento" nem cálculo de quantidade nos receituários', () => {
    for (const tipo of ['receituario', 'receituario-especial']) {
      for (const h of ['HUB', 'SES'] as const) {
        const def = varianteDe(tipo, h)!;
        expect(def.extraInputs?.some((i) => i.key === 'dias'), `${tipo}/${h}`).toBe(false);
      }
    }
    const def = varianteDe('receituario', 'HUB')!;
    const v = valoresDoDocumento(def, { ...ctxCompleto(), extra: { dias: '5', itens: [item({ prescricao: 'Tenoxicam 40 mg', posologia: 'x' })] } });
    expect(v['doc.corpo']).toBe('1. Tenoxicam 40 mg\n    x');
  });

  it('modelos publicados não guardam campos do cálculo antigo', () => {
    const bruto = readFileSync(new URL('../src/presets/modelos.json', import.meta.url), 'utf8');
    expect(bruto).not.toMatch(/porDose|vezesAoDia|"unidade"/);
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

  it('cada cartão tem clínica, data e hora próprias; só os cartões existentes saem', () => {
    const ctx = ctxCompleto();
    ctx.extra.cartoes = [
      { clinica: 'Cirurgia geral', data: '2026-10-20', hora: '08:00' },
      { clinica: 'Cardiologia', data: '2026-11-03', hora: '14:30' },
    ];
    const v = valoresDoDocumento(def, ctx);
    expect([1, 2, 3, 4].map((i) => v[`doc.c${i}`])).toEqual(['true', 'true', '', '']);
    expect([v['doc.c1.clinica'], v['doc.c1.dia'], v['doc.c1.hora']]).toEqual(['Cirurgia geral', '20', '08:00']);
    expect([v['doc.c2.clinica'], v['doc.c2.dia'], v['doc.c2.mes'], v['doc.c2.ano']]).toEqual(['Cardiologia', '03', '11', '2026']);
    expect(v['doc.c5']).toBeUndefined();
  });

  it('cobra os campos vazios de cada cartão, com o número do cartão', async () => {
    const ctx = ctxCompleto();
    ctx.extra.cartoes = [{ clinica: 'Cirurgia geral', data: '2026-10-20', hora: '08:00' }, {}];
    const g = await gerarDocumento(def, ctx, bytes(def));
    expect([...new Set(g.vazios.map((x) => x.label))]).toEqual(['Cartão 2: clínica', 'Cartão 2: data', 'Cartão 2: hora']);
  });

  it('no máximo 4 cartões', () => {
    const ctx = ctxCompleto();
    ctx.extra.cartoes = Array.from({ length: 6 }, () => ({ clinica: 'X', data: '2026-10-20', hora: '08:00' }));
    expect(valoresDoDocumento(def, ctx)['doc.c4']).toBe('true');
    expect(def.extraInputs?.[0].max).toBe(4);
  });

  it('só a metade de cima: 4 cartões, máscara cobre a de baixo e o resto é meia folha', () => {
    expect(def.fields.every((c) => 'y' in c && c.y > 424)).toBe(true);
    expect(def.mascaras).toEqual([{ page: 0, x: 0, y: 0, width: 596, height: 424 }]);
    expect(def.meiaFolha).toEqual({ page: 0, x: 0, y: 424, width: 596, height: 419 });
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
