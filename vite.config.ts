/// <reference types="vitest/config" />
import { createReadStream, existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Fontes padrão do PDF (Helvetica etc., não embutidas nos PDFs gerados pelo pdf-lib) para o
 * pdf.js desenhar a pré-visualização fielmente. Servidas do próprio site: nada de CDN.
 */
function pdfjsFontesPadrao(): Plugin {
  const dir = path.resolve('node_modules/pdfjs-dist/standard_fonts');
  const prefixo = '/pdfjs/standard_fonts/';
  return {
    name: 'pdfjs-fontes-padrao',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.startsWith(prefixo)) return next();
        const arq = path.join(dir, path.basename(decodeURIComponent(url.slice(prefixo.length))));
        if (!existsSync(arq)) return next();
        res.setHeader('Content-Type', 'application/octet-stream');
        createReadStream(arq).pipe(res);
      });
    },
    generateBundle() {
      for (const f of readdirSync(dir)) {
        this.emitFile({ type: 'asset', fileName: `pdfjs/standard_fonts/${f}`, source: readFileSync(path.join(dir, f)) });
      }
    },
  };
}

export default defineConfig({
  // Relative base: works on GitHub Pages regardless of the repository name.
  base: './',
  plugins: [pdfjsFontesPadrao()],
  build: {
    // tools/calibrate.html is dev-only and is not part of the build.
    rollupOptions: { input: { main: 'index.html', adm: 'adm.html' } },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
