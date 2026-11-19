// Lector mínimo de .zip en el navegador (métodos "guardado" y "deflate"), sin librerías.
export interface EntradaZip {
  nombre: string;
  leer: () => Promise<Uint8Array>;
}

export async function abrirZip(buf: ArrayBuffer): Promise<EntradaZip[]> {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Ese archivo no parece un .zip.");
  const total = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const texto = new TextDecoder("utf-8");
  const entradas: EntradaZip[] = [];
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("El .zip está dañado.");
    const metodo = v.getUint16(p + 10, true);
    const comp = v.getUint32(p + 20, true);
    const lnom = v.getUint16(p + 28, true);
    const lext = v.getUint16(p + 30, true);
    const lcom = v.getUint16(p + 32, true);
    const off = v.getUint32(p + 42, true);
    const nombre = texto.decode(bytes.subarray(p + 46, p + 46 + lnom));
    p += 46 + lnom + lext + lcom;
    if (comp === 0xffffffff || off === 0xffffffff) throw new Error("Ese .zip es demasiado grande o de un formato no soportado.");
    if (nombre.endsWith("/") || nombre.startsWith("__MACOSX/") || /(^|\/)(\.DS_Store|Thumbs\.db|\._.*)$/.test(nombre)) continue;
    entradas.push({
      nombre,
      leer: async () => {
        const inicio = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
        const datos = bytes.subarray(inicio, inicio + comp);
        if (metodo === 0) return datos;
        if (metodo !== 8) throw new Error(`Compresión no soportada en ${nombre}.`);
        const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(flujo).arrayBuffer());
      },
    });
  }
  return entradas;
}
