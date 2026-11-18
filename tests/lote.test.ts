import { test } from "node:test";
import assert from "node:assert/strict";
import { claveFoto, fichaAAviso, leerFichas } from "../shared/lote.ts";

const TXT = `Acá van las fichas:

**AVISO 01**
**Rubro:** Inmuebles
**Tipo:** casa
**Operación:** Venta
**Título:** Casa de 3 dormitorios
**Precio:** 68.000
**Moneda:** USD
**Pueblo:** sanford
**Descripción:** Casa de material sobre lote de 12x40.
Tiene quincho cerrado al fondo.
**Datos destacados:** 3 dormitorios, cochera
**Acepta permuta:** sí
**Financia:** FALTA
**Nombre del vendedor:** Roberto
**WhatsApp del vendedor:** 3464 40-0000
**Fotos:** 01-1 (frente), 01-2 (cocina)
**Autorización del vendedor:** sí, lo pidió él

AVISO 02
Rubro: Vehículos
Tipo: camioneta o utilitario
Operación: venta
Título: Toyota Hilux SRV 2018
Precio: 32000 (REVISAR: también dice 30.500)
Moneda: dólares
Pueblo: Chabás
Descripción: Doble cabina, único dueño.
Nombre del vendedor: Marta
WhatsApp del vendedor: FALTA
Fotos: 02-1

A) FALTAN DATOS
AVISO 03
Rubro: Inmuebles
`;

test("lee las fichas: formatos, multilínea, FALTA y REVISAR", () => {
  const f = leerFichas(TXT);
  assert.equal(f.length, 2, "corta en las listas finales");
  assert.equal(f[0]!.campos.descripcion, "Casa de material sobre lote de 12x40. Tiene quincho cerrado al fondo.");
  assert.deepEqual(f[0]!.fotosRef, ["1-1", "1-2"]);
  assert.equal(f[1]!.campos.precio, "32000");
  assert.ok(f[1]!.avisos.some((a) => a.includes("30.500")));
});

test("convierte a aviso: normaliza y marca lo que falta o no se puede cargar", () => {
  const [a, b] = leerFichas(TXT).map(fichaAAviso);
  assert.equal(a!.errores.length, 0);
  assert.equal(a!.aviso?.pueblo, "Sanford");
  assert.equal(a!.aviso?.tipo, "Casa");
  assert.equal(a!.aviso?.precio, 68000);
  assert.equal(a!.aviso?.moneda, "USD");
  assert.equal(a!.aviso?.permuta, true);
  assert.equal(a!.aviso?.financia, false);
  assert.equal(a!.aviso?.telefono, "3464400000");
  assert.deepEqual(a!.aviso?.datos, ["3 dormitorios", "cochera"]);
  assert.equal(b!.aviso, null, "sin teléfono no se carga");
  assert.ok(b!.errores.some((e) => /tel[eé]fono|whatsapp/i.test(e)));
  assert.ok(b!.avisos.some((x) => x.includes("autorización")));
});

test("nombres de fotos", () => {
  assert.equal(claveFoto("01/01-2.jpg"), "1-2");
  assert.equal(claveFoto("fotos/aviso 03 - 10.PNG"), "3-10");
  assert.equal(claveFoto("IMG-9999.jpg"), null);
});
