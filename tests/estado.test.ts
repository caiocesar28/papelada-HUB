import { describe, expect, it } from 'vitest';
import { varianteDe } from '../src/registry';
import { campoObrigatorio, camposPacienteUsados, contexto, documentosAtivos, estadoInicial, iniciarExtras } from '../src/ui/estado';

describe('estado da tela', () => {
  it('começa vazio, com a data de hoje e hospital HUB', () => {
    const e = estadoInicial();
    expect(e.hospital.tipo).toBe('HUB');
    expect(e.dataIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(documentosAtivos(e)).toEqual([]);
  });

  it('troca a variante pelo hospital e esconde o que não existe', () => {
    const e = estadoInicial();
    e.selecionados = new Set(['receituario', 'tcle-cirurgia']);
    expect(documentosAtivos(e).map((d) => d.id)).toEqual(['receituario-hub', 'tcle-cirurgia']);
    e.hospital.tipo = 'SES';
    expect(documentosAtivos(e).map((d) => d.id)).toEqual(['receituario-ses']);
  });

  it('pede só os campos do paciente que os documentos usam', () => {
    expect(camposPacienteUsados([varianteDe('receituario', 'HUB')!])).toEqual([]);
    expect(camposPacienteUsados([varianteDe('tcle-cirurgia', 'HUB')!])).toEqual([
      'dataNascimento', 'rg', 'orgaoExpedidor', 'uf', 'diagnostico', 'procedimento',
    ]);
  });

  it('TCLE: campos extras do paciente são opcionais', () => {
    const tcle = [varianteDe('tcle-cirurgia', 'HUB')!];
    expect(campoObrigatorio(tcle, 'rg')).toBe(false);
    expect(campoObrigatorio(tcle, 'dataNascimento')).toBe(false);
    expect(campoObrigatorio(tcle, 'nome')).toBe(true);
    expect(campoObrigatorio([varianteDe('receituario', 'SES')!], 'clinica')).toBe(false);
  });

  it('receita: só os itens marcados, com o texto editado, entram no contexto', () => {
    const e = estadoInicial();
    const def = varianteDe('receituario', 'HUB')!;
    iniciarExtras(e, def);
    const itens = e.receitas.receituario.itens;
    expect(itens.filter((i) => i.marcado).map((i) => i.id)).toEqual(['dipirona', 'tenoxicam', 'ondansetrona']);
    itens[1].marcado = true;
    itens[1].posologia = 'editado na tela';
    itens[0].marcado = false;
    const lista = contexto(e, def).extra.itens as Array<{ id: string; posologia: string }>;
    expect(lista.map((i) => i.id)).toEqual(['paracetamol', 'tenoxicam', 'ondansetrona']);
    expect(lista[0].posologia).toBe('editado na tela');
    expect(lista[0]).not.toHaveProperty('marcado');
  });

  it('extras são compartilhados entre variantes do mesmo tipo', () => {
    const e = estadoInicial();
    const hub = varianteDe('receituario', 'HUB')!;
    const ses = varianteDe('receituario', 'SES')!;
    iniciarExtras(e, hub);
    e.receitas.receituario.itens[0].marcado = true;
    iniciarExtras(e, ses);
    expect(e.receitas.receituario.itens[0].marcado).toBe(true);
  });

  it('valores padrão dos extraInputs e data do documento ao meio-dia de Brasília', () => {
    const e = estadoInicial();
    const def = varianteDe('retorno', 'HUB')!;
    iniciarExtras(e, def);
    expect(e.extras.retorno.vias).toBe('1');
    e.dataIso = '2026-12-31';
    expect(contexto(e, def).data.toISOString()).toBe('2026-12-31T15:00:00.000Z');
  });
});
