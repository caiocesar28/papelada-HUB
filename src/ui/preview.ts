/**
 * Pré-visualização: desenha o PDF gerado em <canvas> com o pdf.js (empacotado, sem CDN).
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

type Tarefa = ReturnType<typeof pdfjs.getDocument>;

let atual: { tarefa: Tarefa; cancelado: boolean } | null = null;

/** Substitui o conteúdo de `alvo` pelas páginas do PDF, na largura do alvo. */
export async function mostrarPdf(alvo: HTMLElement, bytes: Uint8Array): Promise<void> {
  if (atual) {
    atual.cancelado = true;
    void atual.tarefa.destroy();
  }
  const tarefa = pdfjs.getDocument({
    data: bytes,
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
  });
  const este = { tarefa, cancelado: false };
  atual = este;

  try {
    const doc = await tarefa.promise;
    const largura = Math.max(320, alvo.clientWidth - 2);
    const dpr = window.devicePixelRatio || 1;
    const canvases: HTMLCanvasElement[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: largura / base.width });
      const c = document.createElement('canvas');
      c.width = Math.floor(vp.width * dpr);
      c.height = Math.floor(vp.height * dpr);
      c.style.width = `${vp.width}px`;
      c.style.height = `${vp.height}px`;
      c.className = 'pagina-pdf';
      await page.render({
        canvas: c,
        canvasContext: c.getContext('2d')!,
        viewport: vp,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise;
      if (este.cancelado) return;
      canvases.push(c);
    }
    if (!este.cancelado) alvo.replaceChildren(...canvases);
  } catch (e) {
    if (!este.cancelado) throw e;
  }
}
