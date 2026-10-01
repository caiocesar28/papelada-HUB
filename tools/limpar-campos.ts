/**
 * Gera uma cópia do PDF com todos os campos AcroForm vazios e sem objetos órfãos.
 *
 * Uso: npx tsx tools/limpar-campos.ts <entrada.pdf> <saida.pdf>
 * (PDF criptografado: descriptografar antes, p.ex. com pypdf; o pdf-lib não descriptografa.)
 *
 * Existe porque o espelho do CAMed publica formulários com valores salvos (o receituário SES
 * traz uma receita real). O pdf-lib não descarta objetos órfãos ao salvar, então a aparência
 * antiga dos campos sobreviveria no arquivo; por isso a coleta de lixo antes de salvar.
 * Conferir o resultado procurando o texto antigo em todos os objetos decodificados.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  PDFArray,
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFRawStream,
  PDFRef,
  PDFTextField,
  StandardFonts,
  type PDFObject,
} from 'pdf-lib';

export async function limparCampos(bytes: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const form = pdf.getForm();
  for (const f of form.getFields()) {
    if (f instanceof PDFTextField) f.setText('');
    else if (f instanceof PDFCheckBox) f.uncheck();
    else if (f instanceof PDFRadioGroup || f instanceof PDFDropdown || f instanceof PDFOptionList) f.clear();
    // Valor padrão (/DV) também guarda texto.
    f.acroField.dict.delete(PDFName.of('DV'));
  }
  form.updateFieldAppearances(await pdf.embedFont(StandardFonts.Helvetica));
  coletarLixo(pdf);
  return pdf.save({ useObjectStreams: false });
}

/** Remove do contexto todo objeto indireto inalcançável a partir do trailer. */
function coletarLixo(pdf: PDFDocument): void {
  const ctx = pdf.context;
  const vistos = new Set<string>();
  const pilha: PDFObject[] = [ctx.trailerInfo.Root, ctx.trailerInfo.Info].filter(Boolean) as PDFObject[];
  while (pilha.length) {
    const o = pilha.pop()!;
    if (o instanceof PDFRef) {
      if (vistos.has(o.toString())) continue;
      vistos.add(o.toString());
      const alvo = ctx.lookup(o);
      if (alvo) pilha.push(alvo);
    } else if (o instanceof PDFDict) {
      for (const [, v] of o.entries()) pilha.push(v);
    } else if (o instanceof PDFArray) {
      for (const v of o.asArray()) pilha.push(v);
    } else if (o instanceof PDFRawStream) {
      pilha.push(o.dict);
    } else if (o && 'dict' in (o as object)) {
      pilha.push((o as unknown as { dict: PDFDict }).dict);
    }
  }
  for (const [ref] of ctx.enumerateIndirectObjects()) {
    if (!vistos.has(ref.toString())) ctx.delete(ref);
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/limpar-campos.ts')) {
  const [entrada, saida] = process.argv.slice(2);
  if (!entrada || !saida) {
    console.error('uso: npx tsx tools/limpar-campos.ts <entrada.pdf> <saida.pdf>');
    process.exit(1);
  }
  const limpo = await limparCampos(readFileSync(entrada));
  writeFileSync(saida, limpo);
  console.log(`ok: ${saida} (${limpo.length} bytes)`);
}
