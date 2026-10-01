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
  /** Linha 1 da receita: medicamento, concentração, quantidade. Vazio = usa `nome`. */
  prescricao: string;
  /** Linha 2: como usar. Vazio = linha em branco para escrever à mão. */
  posologia: string;
  /**
   * Quantidade = porDose × vezesAoDia × dias de tratamento, em `unidade`. Os números vêm do
   * modelo escrito pelo usuário; sem eles, a quantidade fica em branco (ou usa `quantidade`).
   */
  porDose?: number;
  vezesAoDia?: number;
  /** Plural, p.ex. 'comprimidos'. */
  unidade?: string;
  /** Quantidade digitada; tem prioridade sobre a calculada. */
  quantidade?: string;
  /** Já vem marcado. */
  padrao?: boolean;
}

export type ValorExtra = string | boolean | ItemReceita[];

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
}

export type CampoDef = CampoAcroform | CampoOverlay;

export function isAcroform(c: CampoDef): c is CampoAcroform {
  return 'name' in c;
}

export interface ExtraInput {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'checkbox' | 'receita';
  /** Valor inicial. */
  padrao?: ValorExtra;
  placeholder?: string;
  /** type 'receita': id do modelo de receita carregado de início (src/modelos). */
  modeloPadrao?: string;
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
  extraInputs?: ExtraInput[];
  /** Valores derivados ('doc.*'), p.ex. corpo da receita, data por extenso, condições `se`. */
  calcular?: (v: Record<string, string>, ctx: Contexto) => Record<string, string>;
}
