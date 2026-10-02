/**
 * Converte o "Papel Timbrado EBSERH.doc" do espelho do CAMed (forms-originais/) no PDF usado
 * pelo app (public/forms/papel-timbrado-hub.pdf). O .doc é só fundo: cada página tem uma imagem
 * JPEG de página inteira (A4, 300 dpi) com o cabeçalho e a faixa verde. As imagens são copiadas
 * byte a byte para páginas A4, sem reprocessar. Rodar: npx tsx tools/papel-timbrado.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const ORIGEM = 'forms-originais/papel-timbrado-ebserh.doc';
const DESTINO = 'public/forms/papel-timbrado-hub.pdf';
const A4 = { w: 595.28, h: 841.89 };

/** Fim de um JPEG que começa em `ini` (percorre os segmentos até o EOI). */
function fimDoJpeg(d: Uint8Array, ini: number): number {
  let p = ini + 2;
  for (;;) {
    if (d[p] !== 0xff) throw new Error(`JPEG malformado em ${p}`);
    const m = d[p + 1];
    if (m === 0xd9) return p + 2;
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) {
      p += 2;
      continue;
    }
    p += 2 + ((d[p + 2] << 8) | d[p + 3]);
    if (m === 0xda) {
      // dados comprimidos: termina no próximo marcador que não seja FF00 nem RSTn
      while (!(d[p] === 0xff && d[p + 1] !== 0 && !(d[p + 1] >= 0xd0 && d[p + 1] <= 0xd7))) p++;
    }
  }
}

function jpegs(d: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let p = 0; p < d.length - 3; p++) {
    if (d[p] === 0xff && d[p + 1] === 0xd8 && d[p + 2] === 0xff) {
      const fim = fimDoJpeg(d, p);
      out.push(new Uint8Array(d.subarray(p, fim))); // cópia: o pdf-lib ignora o byteOffset de views
      p = fim - 1;
    }
  }
  return out;
}

const imagens = jpegs(readFileSync(ORIGEM));
if (imagens.length !== 2) throw new Error(`esperava 2 imagens de página no .doc, achei ${imagens.length}`);

const pdf = await PDFDocument.create();
pdf.setTitle('Papel timbrado EBSERH / HUB');
pdf.setProducer('papelada-hub tools/papel-timbrado.ts');
pdf.setCreationDate(new Date('2020-12-02T21:17:00-03:00')); // data do .doc: saída reprodutível
pdf.setModificationDate(new Date('2020-12-02T21:17:00-03:00'));
for (const bytes of imagens) {
  const img = await pdf.embedJpg(bytes);
  pdf.addPage([A4.w, A4.h]).drawImage(img, { x: 0, y: 0, width: A4.w, height: A4.h });
}
writeFileSync(DESTINO, await pdf.save({ useObjectStreams: false }));
console.log(`${DESTINO}: ${imagens.length} páginas`);
