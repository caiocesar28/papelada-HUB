/**
 * Ferramenta de desenvolvimento: descobrir coordenadas (pt) e nomes de campos AcroForm
 * clicando no PDF, já no formato do array `fields` de um DocumentDef.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import manifest from '../forms.manifest.json';
import { hospitalPadrao, pacienteVazio, valores } from '../src/patient';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

type PDFDoc = Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
type PDFPageProxy = Awaited<ReturnType<PDFDoc['getPage']>>;
type Viewport = ReturnType<PDFPageProxy['getViewport']>;

interface Widget {
  name: string;
  page: number;
  rect: [number, number, number, number];
  tipo: string;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('canvas');
const camada = $<HTMLDivElement>('camada');
const saida = $<HTMLTextAreaElement>('saida');
const selForm = $<HTMLSelectElement>('formulario');
const inpArquivo = $<HTMLInputElement>('arquivo');
const inpZoom = $<HTMLInputElement>('zoom');
const inpChave = $<HTMLInputElement>('chave');
const inpTamanho = $<HTMLInputElement>('tamanho');
const inpRotacao = $<HTMLInputElement>('rotacao');
const inpLargura = $<HTMLInputElement>('largura');
const chkWidgets = $<HTMLInputElement>('mostrarWidgets');
const leitura = $<HTMLDivElement>('leitura');

let tarefa: ReturnType<typeof pdfjs.getDocument> | null = null;
let doc: PDFDoc | null = null;
let pagina = 0;
let viewport: Viewport | null = null;
let widgets: Widget[] = [];
let renderizando: { cancel(): void } | null = null;

// --- opções ---------------------------------------------------------------

for (const f of manifest.forms) {
  const o = document.createElement('option');
  o.value = '/' + f.file.replace(/^public\//, '');
  o.textContent = f.id;
  selForm.append(o);
}

// Sugestões de key a partir do vocabulário real de valores().
const chaves = Object.keys(
  valores({ paciente: pacienteVazio(), hospital: hospitalPadrao(), data: new Date(), extra: {} }),
);
$('chaves').append(
  ...[...chaves, 'extra.'].map((k) => Object.assign(document.createElement('option'), { value: k })),
);

// --- carregar --------------------------------------------------------------

selForm.addEventListener('change', async () => {
  if (!selForm.value) return;
  const res = await fetch(selForm.value);
  await abrir(new Uint8Array(await res.arrayBuffer()));
});

inpArquivo.addEventListener('change', async () => {
  const f = inpArquivo.files?.[0];
  if (!f) return;
  selForm.value = '';
  await abrir(new Uint8Array(await f.arrayBuffer()));
});

// Ferramenta só de dev: o Vite serve node_modules diretamente.
const PDFJS = '/node_modules/pdfjs-dist/';

async function abrir(bytes: Uint8Array): Promise<void> {
  renderizando?.cancel();
  renderizando = null;
  await tarefa?.destroy();
  tarefa = null;
  doc = null;
  widgets = [];
  camada.replaceChildren();
  try {
    tarefa = pdfjs.getDocument({
      data: bytes,
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      cMapUrl: `${PDFJS}cmaps/`,
      cMapPacked: true,
      iccUrl: `${PDFJS}iccs/`,
      wasmUrl: `${PDFJS}wasm/`,
    });
    doc = await tarefa.promise;
  } catch (e) {
    $('numPagina').textContent = `erro ao abrir: ${(e as Error).message}`;
    return;
  }
  pagina = 0;
  for (let i = 0; i < doc.numPages; i++) {
    const p = await doc.getPage(i + 1);
    for (const a of await p.getAnnotations()) {
      if (a.subtype !== 'Widget' || !a.fieldName) continue;
      widgets.push({ name: a.fieldName, page: i, rect: a.rect, tipo: a.checkBox ? 'checkbox' : a.fieldType });
    }
  }
  await desenhar();
}

// --- desenhar ----------------------------------------------------------------

async function desenhar(): Promise<void> {
  if (!doc) return;
  renderizando?.cancel();
  const page = await doc.getPage(pagina + 1);
  const zoom = Number(inpZoom.value) || 1.5;
  viewport = page.getViewport({ scale: zoom });
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  const task = page.render({
    canvas,
    canvasContext: canvas.getContext('2d')!,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
  });
  renderizando = task;
  try {
    await task.promise;
  } catch {
    return; // cancelado por um redesenho mais novo
  }

  const [, , w, h] = page.view;
  $('numPagina').textContent = `${pagina + 1} / ${doc.numPages}  (page: ${pagina})`;
  $('tamanhoPagina').textContent = `${Math.round(w)} × ${Math.round(h)} pt${page.rotate ? `, rot ${page.rotate}°` : ''}`;
  desenharCamada();
}

function desenharCamada(): void {
  camada.replaceChildren();
  if (!viewport) return;
  const vp = viewport;
  const entradas = lerSaida();
  const usados = new Set(entradas.flatMap((e) => (e.name ? [e.name] : [])));

  if (chkWidgets.checked) {
    for (const w of widgets.filter((w) => w.page === pagina)) {
      const [x1, y1] = vp.convertToViewportPoint(w.rect[0], w.rect[1]);
      const [x2, y2] = vp.convertToViewportPoint(w.rect[2], w.rect[3]);
      const el = document.createElement('div');
      el.className = 'widget' + (usados.has(w.name) ? ' usado' : '');
      Object.assign(el.style, {
        left: `${Math.min(x1, x2)}px`,
        top: `${Math.min(y1, y2)}px`,
        width: `${Math.abs(x2 - x1)}px`,
        height: `${Math.abs(y2 - y1)}px`,
      });
      el.textContent = w.name;
      el.title = `${w.name} (${w.tipo})`;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        adicionar(linhaAcroform(w));
      });
      camada.append(el);
    }
  }

  for (const e of entradas) {
    if (e.page !== pagina || e.x === undefined || e.y === undefined) continue;
    const [vx, vy] = vp.convertToViewportPoint(e.x, e.y);
    const el = document.createElement('div');
    el.className = 'marca';
    el.style.left = `${vx}px`;
    el.style.top = `${vy}px`;
    const txt = document.createElement('span');
    txt.textContent = e.key || '?';
    txt.style.fontSize = `${(e.size ?? 10) * vp.scale}px`;
    if (e.rotate) txt.style.transform = `rotate(${-e.rotate}deg)`;
    el.append(txt);
    camada.append(el);
  }
}

// --- clique e leitura ---------------------------------------------------------

function pontoPdf(ev: MouseEvent): [number, number] | null {
  if (!viewport) return null;
  const r = canvas.getBoundingClientRect();
  const [x, y] = viewport.convertToPdfPoint(ev.clientX - r.left, ev.clientY - r.top);
  return [Math.round(x), Math.round(y)];
}

canvas.addEventListener('mousemove', (ev) => {
  const p = pontoPdf(ev);
  if (p) leitura.textContent = `page: ${pagina}   x: ${p[0]}   y: ${p[1]}`;
});

canvas.addEventListener('click', (ev) => {
  const p = pontoPdf(ev);
  if (!p) return;
  adicionar(linhaOverlay(p[0], p[1]));
});

function chaveAtual(): string {
  return inpChave.value.trim();
}

function linhaOverlay(x: number, y: number): string {
  const partes = [`key: '${chaveAtual()}'`, `page: ${pagina}`, `x: ${x}`, `y: ${y}`];
  const size = Number(inpTamanho.value);
  if (size) partes.push(`size: ${size}`);
  const largura = Number(inpLargura.value);
  if (largura) partes.push(`maxWidth: ${largura}`);
  const rot = Number(inpRotacao.value);
  if (rot) partes.push(`rotate: ${rot}`);
  return `{ ${partes.join(', ')} },`;
}

function linhaAcroform(w: Widget, key = chaveAtual()): string {
  const extra = w.tipo === 'checkbox' ? `, checkbox: true, marcarSe: ''` : '';
  return `{ key: '${key}', name: '${w.name}'${extra} },`;
}

function adicionar(linha: string): void {
  const atual = saida.value.replace(/\s+$/, '');
  saida.value = (atual ? atual + '\n' : '') + linha + '\n';
  saida.scrollTop = saida.scrollHeight;
  inpChave.value = '';
  inpChave.focus();
  desenharCamada();
}

// Leitura tolerante das linhas (sem eval): só o necessário para redesenhar as marcas.
interface Entrada {
  key?: string;
  name?: string;
  page?: number;
  x?: number;
  y?: number;
  size?: number;
  rotate?: number;
}

function lerSaida(): Entrada[] {
  return saida.value.split('\n').map((l) => {
    const s = (k: string) => new RegExp(`\\b${k}\\s*:\\s*['"]([^'"]*)['"]`).exec(l)?.[1];
    const n = (k: string) => {
      const m = new RegExp(`\\b${k}\\s*:\\s*(-?[\\d.]+)`).exec(l);
      return m ? Number(m[1]) : undefined;
    };
    return { key: s('key'), name: s('name'), page: n('page'), x: n('x'), y: n('y'), size: n('size'), rotate: n('rotate') };
  });
}

// --- botões --------------------------------------------------------------------

$('ant').addEventListener('click', () => {
  if (doc && pagina > 0) {
    pagina--;
    void desenhar();
  }
});
$('prox').addEventListener('click', () => {
  if (doc && pagina < doc.numPages - 1) {
    pagina++;
    void desenhar();
  }
});
inpZoom.addEventListener('change', () => void desenhar());
chkWidgets.addEventListener('change', desenharCamada);
saida.addEventListener('input', desenharCamada);

$('copiar').addEventListener('click', () => void navigator.clipboard.writeText(saida.value));
$('limpar').addEventListener('click', () => {
  saida.value = '';
  desenharCamada();
});
$('todosWidgets').addEventListener('click', () => {
  let pag = -1;
  const linhas: string[] = [];
  for (const w of widgets) {
    if (w.page !== pag) {
      pag = w.page;
      linhas.push(`// página ${pag}`);
    }
    linhas.push(`${linhaAcroform(w, '')} // ${w.tipo}`);
  }
  saida.value = linhas.join('\n') + '\n';
  desenharCamada();
});
