/**
 * Contrato de um documento. Cada arquivo em src/documents/<id>.ts exporta `doc: DocumentDef`.
 * Arquivos que começam com '_' são auxiliares e não são registrados.
 */
import type { Contexto, TipoHospital } from './patient';

export type Area = 'clinica' | 'cirurgia' | 'pediatria' | 'go' | 'geral';

/** Item de receita vindo de src/presets/. Os textos são escritos pelo usuário, nunca gerados. */
export interface ItemReceita {
  id: string;
  /** Nome curto mostrado na tela. */
  nome: string;
  /** Linha 1 da receita: medicamento e concentração. Vazio = usa `nome`. */
  prescricao: string;
  /** Linha 2: como usar. Vazio = linha em branco para escrever à mão. */
  posologia: string;
  /**
   * Quantidade a dispensar, como o médico escreveria ("20 comprimidos", "1 frasco"). Valor
   * independente: não é calculado a partir de dose, frequência ou dias. Vazio = sai sem.
   */
  quantidade?: string;
  /** Já vem marcado. */
  padrao?: boolean;
}

/** Uma entrada de uma lista (type 'lista'), p.ex. um cartão de retorno: key → valor. */
export type EntradaLista = Record<string, string>;

export type ValorExtra = string | boolean | ItemReceita[] | EntradaLista[];

/**
 * Campo comum: `key` é uma chave de `valores(ctx)` (src/patient.ts), p.ex. 'paciente.nome',
 * 'hoje.dia', 'extra.dias', ou uma chave 'doc.*' devolvida por `calcular`.
 */
interface CampoBase {
  key: string;
  /** Rótulo mostrado na lista de campos vazios da pré-visualização. */
  label?: string;
  /**
   * Checkbox: marca se o valor da key for igual a `marcarSe`
   * (ou, se omitido, se o valor não for vazio).
   */
  checkbox?: boolean;
  marcarSe?: string;
  /** Campo que pode ficar vazio sem alerta (opcional no formulário). */
  opcional?: boolean;
  /** Só preenche (e só cobra) se esta key tiver valor. Ex.: vias extras, modo emergência. */
  se?: string;
}

/** Preenche um campo AcroForm existente no PDF. */
export interface CampoAcroform extends CampoBase {
  /** Nome do campo no PDF (ver inventário / calibrate). */
  name: string;
  /** Tamanho de fonte; omitido = mantém o do PDF (0 = auto). */
  size?: number;
}

/** Desenha texto sobre a página. Coordenadas em pt, origem no canto inferior esquerdo. */
export interface CampoOverlay extends CampoBase {
  page: number;
  /** Início da linha de base do texto. */
  x: number;
  y: number;
  size?: number;
  /** Largura máxima: a fonte é reduzida até caber (mín. 6 pt). */
  maxWidth?: number;
  /** Rotação em graus, anti-horária (formulários escaneados deitados). */
  rotate?: number;
  /**
   * Quebra o texto em até N linhas dentro de `maxWidth` (a fonte diminui se precisar).
   * Para campos de várias linhas impressas (justificativa, observações).
   */
  linhas?: number;
  /** Distância entre linhas (pt). Padrão: 1,2 × tamanho da fonte. */
  lineHeight?: number;
  /**
   * Caixinhas impressas (um caractere por caixa): x das divisórias, da borda esquerda da 1ª
   * caixa à borda direita da última. Cada caractere sai centrado na sua caixa.
   */
  celulas?: number[];
  /** Com `celulas`: só os dígitos do valor (CNS, CPF, CEP, códigos). */
  soDigitos?: boolean;
}

export type CampoDef = CampoAcroform | CampoOverlay;

export function isAcroform(c: CampoDef): c is CampoAcroform {
  return 'name' in c;
}

/** Busca numa tabela do SUS (src/tabelas.ts). O valor fica como "CÓDIGO — NOME". */
export interface OpcoesBusca {
  tabela?: 'procedimentos-apac' | 'cid10';
  /** Só procedimentos que podem ser o principal da APAC. */
  apenasPrincipal?: boolean;
  /** Key de outro extra (um procedimento): os CIDs compatíveis com ele aparecem primeiro. */
  compativelCom?: string;
}

export interface ExtraInput {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'checkbox' | 'select' | 'receita' | 'lista' | 'busca';
  /** Valor inicial. */
  padrao?: ValorExtra;
  placeholder?: string;
  /** type 'select': opções (o valor é o próprio texto). */
  opcoes?: string[];
  /** type 'receita': id do modelo carregado de início (src/modelos). Omitido = começa vazio. */
  modeloPadrao?: string;
  /**
   * type 'lista': entradas independentes, cada uma com estes campos (p.ex. cartões de retorno
   * com clínica, data e hora próprias). Começa com `min` entradas.
   */
  campos?: Array<{ key: string; label: string; type: 'text' | 'date' | 'busca'; placeholder?: string } & OpcoesBusca>;
  min?: number;
  max?: number;
  /** Nome de uma entrada na tela ("Cartão" → "Cartão 1", "+ Adicionar cartão"). */
  rotuloItem?: string;
  /** type 'busca': ver OpcoesBusca. */
  tabela?: OpcoesBusca['tabela'];
  apenasPrincipal?: boolean;
  compativelCom?: string;
  ajuda?: string;
}

export interface DocumentDef {
  id: string;
  /**
   * Tipo lógico mostrado na seleção (src/tipos.ts). Variantes de hospitais diferentes
   * compartilham o tipo e os extraInputs (mesmas keys).
   */
  tipo: string;
  /** Em quais hospitais esta variante é usada. */
  hospital: TipoHospital[];
  title: string;
  area: Area[];
  /** Caminho relativo a public/, p.ex. 'forms/tcle-cirurgia.pdf'. */
  form: string;
  /**
   * Modo principal. O renderizador decide campo a campo (campo com `name` = AcroForm,
   * com `page/x/y` = overlay), então um documento acroform pode ter campos overlay.
   */
  mode: 'overlay' | 'acroform';
  /** Vias necessárias (2 para ATB). */
  copies: number;
  /**
   * Vias já impressas lado a lado na própria folha do formulário (receituários, ATB).
   * Os campos devem cobrir todas elas; o renderizador gera ceil(copies / viasNaFolha) folhas.
   */
  viasNaFolha?: number;
  /** Quantas páginas do formulário cabem em uma A4 (2 = formulário A5/meia-folha). */
  perSheet: 1 | 2;
  /** Páginas do PDF a imprimir (padrão: todas). */
  pages?: number[];
  fields: CampoDef[];
  /**
   * Áreas da página cobertas de branco antes do preenchimento (pt). Só para descartar cópias
   * extras do formulário (p.ex. metade dos cartões); nunca para esconder texto de um termo.
   */
  mascaras?: Array<{ page: number; x: number; y: number; width: number; height: number }>;
  /**
   * O documento inteiro cabe nesta região de uma página A4 (metade dela). Na impressão com
   * "juntar meias folhas", essa região divide a folha com outra meia folha.
   */
  meiaFolha?: { page: number; x: number; y: number; width: number; height: number };
  extraInputs?: ExtraInput[];
  /** Valores derivados ('doc.*'), p.ex. corpo da receita, data por extenso, condições `se`. */
  calcular?: (v: Record<string, string>, ctx: Contexto) => Record<string, string>;
}
