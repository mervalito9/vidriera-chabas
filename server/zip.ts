// Arma un .zip simple (sin comprimir: las fotos JPG ya vienen comprimidas). Sin dependencias.
// Se escribe archivo por archivo, así una copia grande no se carga entera en memoria.
import { crc32 } from "node:zlib";

type Destino = { write: (b: Buffer) => unknown };

function marcaDos(): { hora: number; fecha: number } {
  const d = new Date();
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    fecha: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Escribe un zip en `destino`. Cada archivo se lee recién cuando le toca. */
export function escribirZip(destino: Destino, archivos: { nombre: string; leer: () => Buffer | null }[]): number {
  const { hora, fecha } = marcaDos();
  const central: Buffer[] = [];
  let offset = 0;
  let cantidad = 0;
  for (const { nombre, leer } of archivos) {
    const datos = leer();
    if (!datos) continue;
    const n = Buffer.from(nombre, "utf8");
    const crc = crc32(datos);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
    h.writeUInt16LE(hora, 10); h.writeUInt16LE(fecha, 12); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(datos.length, 18); h.writeUInt32LE(datos.length, 22); h.writeUInt16LE(n.length, 26); h.writeUInt16LE(0, 28);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
    c.writeUInt16LE(hora, 12); c.writeUInt16LE(fecha, 14); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(datos.length, 20); c.writeUInt32LE(datos.length, 24); c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    destino.write(Buffer.concat([h, n, datos]));
    central.push(c, n);
    offset += h.length + n.length + datos.length;
    cantidad++;
  }
  const cd = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(cantidad, 8); fin.writeUInt16LE(cantidad, 10);
  fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(offset, 16);
  destino.write(Buffer.concat([cd, fin]));
  return cantidad;
}

export function armarZip(archivos: { nombre: string; datos: Buffer }[]): Buffer {
  const partes: Buffer[] = [];
  escribirZip({ write: (b) => partes.push(b) }, archivos.map((a) => ({ nombre: a.nombre, leer: () => a.datos })));
  return Buffer.concat(partes);
}
