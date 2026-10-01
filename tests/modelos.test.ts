import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  CHAVE_RASCUNHO,
  PUBLICADOS,
  comparar,
  descartarRascunho,
  gravarRascunho,
  lerRascunho,
  paraJson,
  validarModelos,
  type ModeloTcle,
  type Modelos,
} from '../src/modelos';
import { varianteDe } from '../src/registry';
import { completarComTracos } from '../src/render/text';
import { aplicarModeloReceita, aplicarModeloTcle, estadoInicial, iniciarExtras } from '../src/ui/estado';

const tcle = (over: Partial<ModeloTcle> = {}): ModeloTcle => ({
  id: 'tcle-apendice',
  nome: 'Apendicectomia',
  termo: 'tcle-cirurgia',
  diagnostico: 'diag do modelo',
  procedimento: 'proc do modelo',
  dispositivos: '',
  complicacoes: 'compl do modelo',
  ...over,
});

class MemStorage {
  dados = new Map<string, string>();
  getItem(k: string) {
    return this.dados.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.dados.set(k, v);
  }
  removeItem(k: string) {
    this.dados.delete(k);
  }
}

describe('modelos publicados (src/presets/modelos.json)', () => {
  it('o arquivo do repositório é válido e já está no formato canônico', () => {
    const bruto = readFileSync(new URL('../src/presets/modelos.json', import.meta.url), 'utf8');
    expect(paraJson(PUBLICADOS)).toBe(bruto);
  });

  it('tem o modelo de sintomáticos usado como padrão pelo receituário', () => {
    const padrao = varianteDe('receituario', 'HUB')!.extraInputs!.find((i) => i.type === 'receita')!.modeloPadrao;
    expect(PUBLICADOS.receitas.some((r) => r.id === padrao)).toBe(true);
  });
});

describe('validação', () => {
  it('recusa lixo, termo desconhecido, número inválido e id repetido', () => {
    expect(() => validarModelos('x')).toThrow();
    expect(() => validarModelos({ tcles: [tcle({ termo: 'nao-existe' })] })).toThrow(/termo desconhecido/);
    expect(() => validarModelos({ receitas: [{ id: 'a', nome: 'b' }] })).toThrow(/sem itens/);
    expect(() =>
      validarModelos({ receitas: [{ id: 'a', nome: 'b', itens: [{ id: 'i', nome: 'n', porDose: 'dois' }] }] }),
    ).toThrow(/porDose/);
    expect(() => validarModelos({ tcles: [tcle(), tcle()] })).toThrow(/id repetido/);
  });

  it('paraJson remove campos vazios/indefinidos (arquivo estável para diff no GitHub)', () => {
    const m: Modelos = {
      receitas: [{ id: 'r', nome: 'R', itens: [{ id: 'i', nome: 'I', prescricao: '', posologia: '', unidade: undefined, padrao: false }] }],
      tcles: [],
    };
    expect(JSON.parse(paraJson(m)).receitas[0].itens[0]).toEqual({ id: 'i', nome: 'I', prescricao: '', posologia: '' });
  });
});

describe('rascunho', () => {
  it('grava, lê e descarta; corrompido ou ausente = sem rascunho', () => {
    const s = new MemStorage();
    expect(lerRascunho(s)).toBeNull();
    gravarRascunho({ receitas: [], tcles: [tcle()] }, s);
    expect(lerRascunho(s)?.tcles[0].nome).toBe('Apendicectomia');
    descartarRascunho(s);
    expect(lerRascunho(s)).toBeNull();
    s.setItem(CHAVE_RASCUNHO, '{quebrado');
    expect(lerRascunho(s)).toBeNull();
    expect(lerRascunho(undefined)).toBeNull();
  });

  it('compara com o publicado: alterado, novo e removido', () => {
    const pub: Modelos = { receitas: [], tcles: [tcle(), tcle({ id: 'outro', nome: 'Outro' })] };
    expect(comparar(pub, structuredClone(pub)).mudou).toBe(false);
    const r: Modelos = { receitas: [], tcles: [tcle({ nome: 'Apendicectomia v2' }), tcle({ id: 'novo', nome: 'Novo' })] };
    const c = comparar(pub, r);
    expect(c.situacao).toEqual({ 'tcle-apendice': 'alterado', novo: 'novo' });
    expect(c.removidos).toEqual(['Outro']);
    expect(c.mudou).toBe(true);
  });
});

describe('estado com modelos', () => {
  it('o app usa os publicados', () => {
    expect(estadoInicial().modelos).toBe(PUBLICADOS);
  });

  it('modelo de receita troca os itens e marca os padrões', () => {
    const e = estadoInicial({
      receitas: [
        ...PUBLICADOS.receitas,
        { id: 'pos-op', nome: 'Pós-op', itens: [{ id: 'x', nome: 'X', prescricao: '', posologia: '', padrao: true }] },
      ],
      tcles: [],
    });
    iniciarExtras(e, varianteDe('receituario', 'HUB')!);
    expect(e.modeloReceita['receituario.itens']).toBe('sintomaticos');
    aplicarModeloReceita(e, 'receituario', 'itens', 'pos-op');
    expect(e.receitas.receituario.itens.map((i) => [i.id, i.marcado])).toEqual([['x', true]]);
    expect(e.extras.receituario.dias).toBe('5');
  });

  it('modelo de TCLE preenche diagnóstico, procedimento e campos abertos', () => {
    const e = estadoInicial({ receitas: [], tcles: [tcle()] });
    aplicarModeloTcle(e, 'tcle-cirurgia', 'tcle-apendice');
    expect(e.paciente.diagnostico).toBe('diag do modelo');
    expect(e.paciente.procedimento).toBe('proc do modelo');
    expect(e.extras['tcle-cirurgia']).toEqual({ dispositivos: '', complicacoes: 'compl do modelo' });
    aplicarModeloTcle(e, 'outro-termo', 'tcle-apendice'); // termo errado: nada muda
    expect(e.paciente.diagnostico).toBe('diag do modelo');
  });
});

describe('tracejado', () => {
  it('leva a quantidade até a margem direita', async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const linha = completarComTracos('1. Dipirona 500 mg\t40 comprimidos\n    posologia', 300, font, 10);
    const [l1, l2] = linha.split('\n');
    expect(l1).toMatch(/^1\. Dipirona 500 mg -{10,} 40 comprimidos$/);
    expect(font.widthOfTextAtSize(l1, 10)).toBeLessThanOrEqual(300);
    expect(font.widthOfTextAtSize(l1, 10)).toBeGreaterThan(300 - 2 * font.widthOfTextAtSize('-', 10));
    expect(l2).toBe('    posologia');
    expect(completarComTracos('a\tb', undefined, font, 10)).toBe('a ---- b');
  });
});
