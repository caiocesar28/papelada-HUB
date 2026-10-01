import { describe, expect, it } from 'vitest';
import {
  formatarIdade,
  idade,
  hospitalPadrao,
  pacienteVazio,
  parseIsoData,
  partesNoFuso,
  valores,
} from '../src/patient';

describe('datas', () => {
  it('usa o fuso de Brasília, não o UTC', () => {
    // 01/10/2026 01:30 UTC ainda é 30/09 em Brasília (UTC-3)
    expect(partesNoFuso(new Date('2026-10-01T01:30:00Z'))).toEqual({ dia: 30, mes: 9, ano: 2026 });
  });

  it('lê aaaa-mm-dd sem passar por Date e rejeita datas inválidas', () => {
    expect(parseIsoData('1990-02-28')).toEqual({ dia: 28, mes: 2, ano: 1990 });
    expect(parseIsoData('2023-02-29')).toBeNull();
    expect(parseIsoData('28/02/1990')).toBeNull();
    expect(parseIsoData('')).toBeNull();
  });
});

describe('idade', () => {
  const ref = { dia: 1, mes: 10, ano: 2026 };
  it('conta anos completos', () => {
    expect(idade({ dia: 1, mes: 10, ano: 1990 }, ref)?.anos).toBe(36);
    expect(idade({ dia: 2, mes: 10, ano: 1990 }, ref)?.anos).toBe(35);
  });
  it('lactente em meses, recém-nascido em dias', () => {
    expect(formatarIdade(idade({ dia: 15, mes: 5, ano: 2026 }, ref)!)).toBe('4 meses');
    expect(formatarIdade(idade({ dia: 20, mes: 9, ano: 2026 }, ref)!)).toBe('11 dias');
    expect(formatarIdade(idade({ dia: 30, mes: 9, ano: 2026 }, ref)!)).toBe('1 dia');
  });
  it('nascimento no futuro não tem idade', () => {
    expect(idade({ dia: 2, mes: 10, ano: 2026 }, ref)).toBeNull();
  });
});

describe('valores', () => {
  it('achata o contexto nas chaves usadas pelos documentos', () => {
    const paciente = { ...pacienteVazio(), nome: '  Maria da Silva ', dataNascimento: '1990-02-28', sexo: 'F' as const };
    const v = valores({
      paciente,
      hospital: { tipo: 'SES', nome: ' HRAN ' },
      data: new Date('2026-10-01T15:00:00-03:00'),
      extra: { dias: '3', emergencia: true, outro: false },
    });
    expect(v['paciente.nome']).toBe('Maria da Silva');
    expect(v['paciente.sexo']).toBe('F');
    expect(v['paciente.dataNascimento']).toBe('28/02/1990');
    expect(v['paciente.dataNascimento.ano']).toBe('1990');
    expect(v['paciente.idade']).toBe('36 anos');
    expect(v['hoje']).toBe('01/10/2026');
    expect(v['hoje.mesExtenso']).toBe('outubro');
    expect(v['hoje.hora']).toBe('15:00');
    expect(v['hospital.nome']).toBe('HRAN');
    expect(v['hoje.extenso']).toBe('01 de outubro de 2026');
    expect(v['extra.dias']).toBe('3');
    expect(v['extra.emergencia']).toBe('true');
    expect(v['extra.outro']).toBe('');
  });

  it('não inventa nada quando o paciente está vazio', () => {
    const v = valores({ paciente: pacienteVazio(), hospital: hospitalPadrao(), data: new Date(), extra: {} });
    expect(v['hospital.nome']).toBe('HUB');
    for (const [k, val] of Object.entries(v)) {
      if (!k.startsWith('hoje') && k !== 'hospital.nome') expect(val, k).toBe('');
    }
  });
});
