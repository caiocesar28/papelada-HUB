/**
 * Tabelas de referência do SUS para a APAC (geradas por tools/tabelas.py a partir do SIGTAP):
 * procedimentos que podem ir em APAC e CID-10. São baixadas do próprio site só quando uma
 * busca é aberta (o resto do app não paga esse peso). Nenhum dado de paciente é enviado.
 *
 * O valor guardado num campo de busca é "CÓDIGO — NOME" (legível e sem depender da tabela
 * carregada na hora de gerar o PDF).
 */
export type NomeTabela = 'procedimentos-apac' | 'cid10';

export interface EntradaTabela {
  codigo: string;
  nome: string;
  /** Procedimento: pode ser o principal da APAC (registro 06). */
  principal: boolean;
  /** Texto normalizado para busca (código, código formatado e nome, sem acentos). */
  chave: string;
}

export const SEPARADOR = ' — ';

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** 'K359' → 'K35.9' (CID com subcategoria). */
export function formatarCid(c: string): string {
  return c.length === 4 ? `${c.slice(0, 3)}.${c.slice(3)}` : c;
}

/** '0201010160' → '02.01.01.016-0' (formato usual do SIGTAP). */
export function formatarProcedimento(c: string): string {
  return /^\d{10}$/.test(c) ? `${c.slice(0, 2)}.${c.slice(2, 4)}.${c.slice(4, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c;
}

export function formatarCodigo(tabela: NomeTabela, c: string): string {
  return tabela === 'cid10' ? formatarCid(c) : formatarProcedimento(c);
}

export function valorDaEntrada(e: Pick<EntradaTabela, 'codigo' | 'nome'>): string {
  return `${e.codigo}${SEPARADOR}${e.nome}`;
}

/** "CÓDIGO — NOME" → partes (valor vazio ou digitado à mão → código vazio). */
export function lerValor(v: string | undefined): { codigo: string; nome: string } {
  const i = (v ?? '').indexOf(SEPARADOR);
  if (i < 0) return { codigo: '', nome: '' };
  return { codigo: v!.slice(0, i).trim(), nome: v!.slice(i + SEPARADOR.length).trim() };
}

export function montarEntradas(tabela: NomeTabela, linhas: Array<[string, string, number?]>): EntradaTabela[] {
  return linhas.map(([codigo, nome, principal]) => ({
    codigo,
    nome,
    principal: principal === 1,
    chave: normalizar(`${codigo} ${formatarCodigo(tabela, codigo)} ${nome}`),
  }));
}

/**
 * Busca por código (com ou sem pontuação) ou por palavras do nome, em qualquer ordem e sem
 * acentos. `prioridade`: códigos que vêm primeiro (p.ex. CIDs compatíveis com o procedimento).
 */
export function buscar(
  entradas: EntradaTabela[],
  termo: string,
  opts: { limite?: number; prioridade?: Set<string>; apenasPrincipal?: boolean } = {},
): EntradaTabela[] {
  const { limite = 30, prioridade, apenasPrincipal } = opts;
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  const soDigitos = termo.replace(/[.\-\s]/g, '');
  const achados = entradas.filter(
    (e) =>
      (!apenasPrincipal || e.principal) &&
      (palavras.every((p) => e.chave.includes(p)) || (soDigitos.length > 1 && e.codigo.toLowerCase().startsWith(soDigitos.toLowerCase()))),
  );
  const peso = (e: EntradaTabela) =>
    (prioridade?.has(e.codigo) ? 0 : 2) + (e.codigo.toLowerCase().startsWith(soDigitos.toLowerCase()) ? 0 : 1);
  return achados.sort((a, b) => peso(a) - peso(b) || a.codigo.localeCompare(b.codigo)).slice(0, limite);
}

// --- carregamento (navegador) ----------------------------------------------------------

const cache = new Map<string, Promise<unknown>>();

function baixar<T>(arquivo: string): Promise<T> {
  let p = cache.get(arquivo) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}tabelas/${arquivo}`).then((r) => {
      if (!r.ok) throw new Error(`não consegui carregar a tabela ${arquivo} (HTTP ${r.status})`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(arquivo));
    cache.set(arquivo, p);
  }
  return p;
}

const entradasCache = new Map<NomeTabela, Promise<EntradaTabela[]>>();

export function carregarTabela(tabela: NomeTabela): Promise<EntradaTabela[]> {
  let p = entradasCache.get(tabela);
  if (!p) {
    p = baixar<Array<[string, string, number?]>>(`${tabela}.json`).then((l) => montarEntradas(tabela, l));
    p.catch(() => entradasCache.delete(tabela));
    entradasCache.set(tabela, p);
  }
  return p;
}

/** CIDs compatíveis com cada procedimento de APAC (rl_procedimento_cid). */
export function carregarCompatibilidade(): Promise<Record<string, string[]>> {
  return baixar('compat-apac.json');
}
