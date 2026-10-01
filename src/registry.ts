import type { DocumentDef } from './document';
import type { TipoHospital } from './patient';

/**
 * Todos os documentos, descobertos automaticamente: basta criar src/documents/<id>.ts
 * exportando `doc`. Arquivos '_*.ts' são auxiliares.
 */
const modulos = import.meta.glob<{ doc: DocumentDef }>(['./documents/*.ts', '!./documents/_*.ts'], {
  eager: true,
});

export const documentos: DocumentDef[] = Object.entries(modulos)
  .map(([caminho, m]) => {
    if (!m.doc) throw new Error(`${caminho} não exporta 'doc'`);
    return m.doc;
  })
  .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

const ids = new Set<string>();
for (const d of documentos) {
  if (ids.has(d.id)) throw new Error(`id de documento duplicado: ${d.id}`);
  ids.add(d.id);
}

/** Variante de um tipo para o hospital escolhido (ou undefined se não existir). */
export function varianteDe(tipo: string, hospital: TipoHospital): DocumentDef | undefined {
  return documentos.find((d) => d.tipo === tipo && d.hospital.includes(hospital));
}
