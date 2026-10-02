import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { calcularApac } from '../src/documents/_apac';
import { pacienteVazio, valores, type Contexto } from '../src/patient';
import { varianteDe } from '../src/registry';
import { gerarDocumento } from '../src/render';
import { celulasIguais } from '../src/render/fill';
import {
  buscar,
  formatarCid,
  formatarProcedimento,
  lerValor,
  montarEntradas,
  valorDaEntrada,
} from '../src/tabelas';

const json = (arq: string) => JSON.parse(readFileSync(new URL(`../public/tabelas/${arq}`, import.meta.url), 'utf8'));
const procedimentos = montarEntradas('procedimentos-apac', json('procedimentos-apac.json'));
const cids = montarEntradas('cid10', json('cid10.json'));

function ctx(extra: Contexto['extra'], paciente: Partial<Contexto['paciente']> = {}): Contexto {
  return {
    paciente: { ...pacienteVazio(), nome: 'Paciente de teste', registro: '1', ...paciente },
    hospital: { tipo: 'HUB', nome: '' },
    data: new Date('2026-10-01T10:00:00-03:00'),
    extra,
  };
}

describe('tabelas do SIGTAP', () => {
  it('arquivos gerados: procedimentos de APAC, CID-10 e manifesto com a competência', () => {
    expect(procedimentos.length).toBeGreaterThan(1000);
    expect(procedimentos.some((p) => p.principal)).toBe(true);
    expect(cids.length).toBeGreaterThan(14000);
    const m = json('tabelas.manifest.json');
    expect(m.competencia).toMatch(/^\d{6}$/);
    expect(m.procedimentos).toBe(procedimentos.length);
    for (const p of procedimentos) expect(p.codigo).toMatch(/^\d{10}$/);
  });

  it('acentos preservados (arquivos do SIGTAP são Windows-1252)', () => {
    expect(cids.find((c) => c.codigo === 'A000')?.nome).toMatch(/^Cólera/);
  });

  it('busca por palavras sem acento, em qualquer ordem, e por código com ou sem pontuação', () => {
    expect(buscar(cids, 'apendicite aguda').map((c) => c.codigo)).toContain('K359');
    expect(buscar(cids, 'colera')[0].nome).toMatch(/Cólera/);
    expect(buscar(cids, 'K35.9')[0].codigo).toBe('K359');
    expect(buscar(procedimentos, '02.01.01.022-4')[0].codigo).toBe('0201010224');
    expect(buscar(procedimentos, 'ganglio biopsia')[0].nome).toMatch(/GANGLIO/);
  });

  it('apenas principal e prioridade (CIDs compatíveis primeiro)', () => {
    expect(buscar(procedimentos, '', { apenasPrincipal: true, limite: 5000 }).every((p) => p.principal)).toBe(true);
    const prioridade = new Set(['R590']);
    expect(buscar(cids, 'R5', { prioridade })[0].codigo).toBe('R590');
  });

  it('valor salvo "CÓDIGO — NOME" e formatação', () => {
    const v = valorDaEntrada({ codigo: 'K359', nome: 'Apendicite aguda sem outra especificação' });
    expect(lerValor(v)).toEqual({ codigo: 'K359', nome: 'Apendicite aguda sem outra especificação' });
    expect(lerValor('digitado à mão')).toEqual({ codigo: '', nome: '' });
    expect(formatarCid('K359')).toBe('K35.9');
    expect(formatarCid('K35')).toBe('K35');
    expect(formatarProcedimento('0201010224')).toBe('02.01.01.022-4');
  });
});

describe('APAC', () => {
  it('derivados: código/nome do procedimento, CIDs formatados, CNS e telefone só dígitos', () => {
    const c = ctx(
      {
        procedimento: '0201010224 — BIOPSIA DE GANGLIO LINFATICO',
        cidPrincipal: 'R590 — Aumento de volume localizado de gânglios linfáticos',
        cidCausas: 'C80 — Neoplasia maligna, sem especificação de localização',
        secundarios: [{ procedimento: '0201010372 — BIOPSIA DE PELE E PARTES MOLES', qtde: '' }, {}],
      },
      { cartaoSus: '898 0012 3456 7890', telefone: '(61) 99999-0000' },
    );
    const v = calcularApac(valores(c), c);
    expect([v['doc.procCod'], v['doc.procNome'], v['doc.qtde']]).toEqual(['0201010224', 'BIOPSIA DE GANGLIO LINFATICO', '1']);
    expect([v['doc.cid1'], v['doc.cid2'], v['doc.cid3']]).toEqual(['R59.0', '', 'C80']);
    expect(v['doc.cns']).toBe('898001234567890');
    expect([v['doc.telDdd'], v['doc.telNum']]).toEqual(['61', '99999-0000']);
    expect([v['doc.s1'], v['doc.s1.cod'], v['doc.s1.qtde']]).toEqual(['true', '0201010372', '1']);
    expect([v['doc.s2'], v['doc.s2.cod'], v['doc.s3']]).toEqual(['true', '', '']);
  });

  it.each(['HUB', 'SES'] as const)('%s: secundário sem procedimento é cobrado; 2 vias', async (h) => {
    const def = varianteDe('apac', h)!;
    expect(def.copies).toBe(2);
    const c = ctx(
      {
        procedimento: '0201010224 — BIOPSIA DE GANGLIO LINFATICO',
        cidPrincipal: 'R590 — Aumento de volume localizado de gânglios linfáticos',
        secundarios: [{}],
      },
      { cartaoSus: '898001234567890', nomeMae: 'M', dataNascimento: '1950-07-14', diagnostico: 'D' },
    );
    c.hospital = { tipo: h, nome: 'HRAN' };
    const g = await gerarDocumento(def, c, readFileSync(new URL(`../public/${def.form}`, import.meta.url)));
    expect(g.vazios.map((x) => x.label)).toEqual(['Secundário 1: procedimento']);
  });
});

describe('caixinhas (celulas)', () => {
  it('celulasIguais divide a largura por igual', () => {
    expect(celulasIguais(0, 100, 4)).toEqual([0, 25, 50, 75, 100]);
  });

  it('um caractere por caixa: só dígitos, sobra ignorada', async () => {
    const { preencher } = await import('../src/render/fill');
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 100]);
    await pdf.embedFont(StandardFonts.Helvetica);
    const r = await preencher(
      {
        id: 't', tipo: 't', hospital: ['HUB'], title: 't', area: ['geral'], form: '', mode: 'overlay', copies: 1, perSheet: 1,
        fields: [{ key: 'paciente.cep', page: 0, x: 0, y: 50, celulas: [10, 20, 30], soDigitos: true }],
      },
      await pdf.save(),
      { 'paciente.cep': '7-0.8' },
    );
    expect(r.vazios).toEqual([]);
  });
});
