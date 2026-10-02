import type { ExtraInput, ValorExtra } from '../document';
import type { Contexto } from '../patient';
import { formatarCid, lerValor } from '../tabelas';

/** Até 5 procedimentos secundários (os dois formulários têm 5 linhas). */
export const MAX_SECUNDARIOS = 5;

/**
 * Entradas da APAC (laudo para solicitação/autorização de procedimento ambulatorial).
 * Procedimentos e CIDs vêm das tabelas oficiais do SIGTAP (public/tabelas, tools/tabelas.py);
 * o app só oferece a lista para escolher, não sugere nada clínico.
 */
export const extrasApac: ExtraInput[] = [
  {
    key: 'procedimento',
    label: 'Procedimento principal',
    type: 'busca',
    tabela: 'procedimentos-apac',
    apenasPrincipal: true,
    ajuda: 'Tabela SIGTAP: só procedimentos que podem ser o principal de uma APAC.',
  },
  { key: 'qtde', label: 'Quantidade', type: 'text', padrao: '1' },
  {
    key: 'secundarios',
    label: 'Procedimentos secundários',
    type: 'lista',
    rotuloItem: 'Procedimento',
    min: 0,
    max: MAX_SECUNDARIOS,
    campos: [
      { key: 'procedimento', label: 'Procedimento', type: 'busca', tabela: 'procedimentos-apac' },
      { key: 'qtde', label: 'Quantidade', type: 'text', placeholder: '1' },
    ],
  },
  {
    key: 'cidPrincipal',
    label: 'CID-10 principal',
    type: 'busca',
    tabela: 'cid10',
    compativelCom: 'procedimento',
    ajuda: 'Os CIDs compatíveis com o procedimento principal (SIGTAP) aparecem primeiro.',
  },
  { key: 'cidSecundario', label: 'CID-10 secundário', type: 'busca', tabela: 'cid10', compativelCom: 'procedimento' },
  { key: 'cidCausas', label: 'CID-10 causas associadas', type: 'busca', tabela: 'cid10' },
  { key: 'observacoes', label: 'Observações (justificativa)', type: 'textarea' },
  { key: 'ibge', label: 'Código IBGE do município', type: 'text', placeholder: '7 dígitos' },
];

const digitos = (s: string | undefined) => (s ?? '').replace(/\D/g, '');

function lista(v: ValorExtra | undefined): Array<Record<string, string>> {
  return Array.isArray(v) ? (v as Array<Record<string, string>>).slice(0, MAX_SECUNDARIOS) : [];
}

/** Códigos, nomes e flags que os campos das duas APACs usam ('doc.*'). */
export function calcularApac(v: Record<string, string>, ctx: Contexto): Record<string, string> {
  const proc = lerValor(v['extra.procedimento']);
  const tel = digitos(v['paciente.telefone']);
  const out: Record<string, string> = {
    'doc.procCod': proc.codigo,
    // formulário com 9 caixas: 8 dígitos + os 2 últimos (dígito verificador) juntos na 9ª
    'doc.procCod8': proc.codigo.slice(0, 8),
    'doc.procCodFim': proc.codigo.slice(8),
    'doc.procNome': proc.nome,
    'doc.qtde': proc.codigo ? v['extra.qtde'] || '1' : '',
    'doc.cid1': formatarCid(lerValor(v['extra.cidPrincipal']).codigo),
    'doc.cid2': formatarCid(lerValor(v['extra.cidSecundario']).codigo),
    'doc.cid3': formatarCid(lerValor(v['extra.cidCausas']).codigo),
    'doc.cns': digitos(v['paciente.cartaoSus']),
    'doc.telDdd': tel.length >= 10 ? tel.slice(0, 2) : '',
    'doc.telNum': tel.length >= 10 ? `${tel.slice(2, -4)}-${tel.slice(-4)}` : v['paciente.telefone'],
  };
  const secundarios = lista(ctx.extra.secundarios);
  for (let i = 1; i <= MAX_SECUNDARIOS; i++) {
    const s = secundarios[i - 1];
    const p = lerValor(s?.procedimento);
    out[`doc.s${i}`] = s ? 'true' : '';
    out[`doc.s${i}.cod`] = p.codigo;
    out[`doc.s${i}.cod8`] = p.codigo.slice(0, 8);
    out[`doc.s${i}.codFim`] = p.codigo.slice(8);
    out[`doc.s${i}.nome`] = p.nome;
    out[`doc.s${i}.qtde`] = s ? s.qtde?.trim() || (p.codigo ? '1' : '') : '';
  }
  return out;
}
