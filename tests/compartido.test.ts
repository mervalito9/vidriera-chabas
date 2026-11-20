// Pruebas de lo que comparten la web y el servidor: teléfonos y datos guiados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatearTelefono, linkWA, numeroWA, telefonoArgentino } from "../shared/whatsapp.ts";
import { escribirGuiado, leerGuiados } from "../shared/datosGuiados.ts";
import { validarAviso, validarBusqueda } from "../shared/validar.ts";

test("teléfonos: se entienden como los escribe la gente", () => {
  const casos: [string, string][] = [
    ["03464 15 40-0000", "3464400000"],
    ["3464 15 400000", "3464400000"],
    ["3464-400000", "3464400000"],
    ["+54 9 3464 40-0000", "3464400000"],
    ["5493464400000", "3464400000"],
    ["(011) 15 4567-8901", "1145678901"],
    ["341 155 123456", "3415123456"],
    ["0341 15 512-3456", "3415123456"],
  ];
  for (const [entrada, salida] of casos) assert.equal(telefonoArgentino(entrada), salida, entrada);
});

test("teléfonos: sin código de área o raros, no pasan", () => {
  for (const malo of ["400000", "15 400000", "12345", "", "abc", "0000000000"]) assert.equal(telefonoArgentino(malo), "", malo);
  assert.equal(numeroWA("15 400000"), "");
  assert.equal(linkWA("15 400000", "hola"), "");
});

test("teléfonos: link de WhatsApp y forma de mostrar", () => {
  assert.equal(numeroWA("03464 15 40-0000"), "5493464400000");
  assert.match(linkWA("3464400000", "Hola!"), /^https:\/\/wa\.me\/5493464400000\?text=Hola!$/);
  assert.equal(formatearTelefono("3464401234"), "3464 40-1234");
  assert.equal(formatearTelefono("3415123456"), "341 512-3456");
  assert.equal(formatearTelefono("1145678901"), "11 4567-8901");
});

test("validar: guarda el teléfono normalizado y explica el error", () => {
  const base = { rubro: "inmuebles", tipo: "Casa", titulo: "Casa con patio", pueblo: "Chabás", nombre: "Roberto", fotos: [] };
  assert.equal(validarAviso({ ...base, telefono: "03464 15 40-0000" }, { exigirFotos: false }).valor.telefono, "3464400000");
  const mal = validarAviso({ ...base, telefono: "15 400000" }, { exigirFotos: false });
  assert.equal(mal.ok, false);
  assert.match(mal.errores.find((e) => e.campo === "telefono")?.msg ?? "", /código de área/);
  assert.equal(validarBusqueda({ rubro: "x", que: "casa", nombre: "Laura", telefono: "0346415555123" }).valor.telefono, "3464555123");
});

test("datos guiados: escriben etiquetas, las leen y respetan lo demás", () => {
  let d = escribirGuiado("vehiculos", ["Cubiertas nuevas"], "km", "98000");
  d = escribirGuiado("vehiculos", d, "anio", "2018");
  d = escribirGuiado("vehiculos", d, "combustible", "Diésel");
  assert.deepEqual(d, ["2018", "98.000 km", "Diésel", "Cubiertas nuevas"]);
  assert.deepEqual(leerGuiados("vehiculos", d).valores, { anio: "2018", km: "98000", combustible: "Diésel" });
  assert.deepEqual(escribirGuiado("vehiculos", d, "km", ""), ["2018", "Diésel", "Cubiertas nuevas"]);
  assert.deepEqual(escribirGuiado("vehiculos", ["2018"], "anio", "20"), [], "un año a medio escribir no se guarda");
  const casa = escribirGuiado("inmuebles", escribirGuiado("inmuebles", [], "dorm", "1"), "cochera", "si");
  assert.deepEqual(casa, ["1 dormitorio", "Cochera"]);
  assert.deepEqual(leerGuiados("inmuebles", ["3 dormitorios", "Patio", "180 m²"]), { valores: { dorm: "3", m2: "180" }, resto: ["Patio"] });
});

test("precios: dólares y pesos se comparan juntos al ordenar y filtrar", async () => {
  const { filtrarAvisos } = await import("../shared/filtrar.ts");
  const base = { rubro: "vehiculos", tipo: "Auto", operacion: "venta", titulo: "x", descripcion: "", zona: "", datos: [], pueblo: "Chabás", permuta: false, financia: false };
  const avisos = [
    { ...base, id: 1, precio: 32000, moneda: "USD" },
    { ...base, id: 2, precio: 7_500_000, moneda: "ARS" },
    { ...base, id: 3, precio: null, moneda: "ARS" },
    { ...base, id: 4, precio: 46_000_000, moneda: "ARS" },
  ] as never[];
  const f = { rubro: "", pueblo: "", q: "", tipo: "", op: "", max: "", moneda: "USD", permuta: false, financia: false, orden: "barato" } as const;
  const ids = (l: { id: number }[]) => l.map((a) => a.id);
  assert.deepEqual(ids(filtrarAvisos(avisos, f, 1000)), [2, 1, 4, 3]);
  assert.deepEqual(ids(filtrarAvisos(avisos, { ...f, orden: "caro" }, 1000)), [4, 1, 2, 3]);
  assert.deepEqual(ids(filtrarAvisos(avisos, { ...f, orden: "", max: "35000" }, 1000)), [1, 2], "hasta USD 35.000 incluye el auto de $7,5 millones");
});

test("alquiler: las condiciones se limpian y se muestran en palabras", async () => {
  const { limpiarCondiciones, renglonesCondiciones, etiquetasCondiciones } = await import("../shared/alquiler.ts");
  assert.equal(limpiarCondiciones({}), null, "sin nada completo no se guarda");
  assert.equal(limpiarCondiciones("cualquier cosa"), null);
  const c = limpiarCondiciones({
    garantias: ["caucion", "inventada", "propietaria"], deposito: "1", adelantado: true, duracion: 24, ajuste: 5, indice: "IPC",
    mascotas: "si", amoblado: "talvez", disponible: "2027-03-01", expensas: 45000, paga: ["luz", "agua", "nafta"], requisitos: "  ingresos   comprobables ",
  });
  assert.ok(c);
  assert.deepEqual(c.garantias, ["propietaria", "caucion"]);
  assert.equal(c.ajuste, null, "cada 5 meses no es una opción");
  assert.equal(c.amoblado, null);
  assert.deepEqual(c.paga, ["luz", "agua"]);
  assert.equal(c.requisitos, "ingresos comprobables");
  const r = Object.fromEntries(renglonesCondiciones(c));
  assert.equal(r["Garantía"], "Garantía propietaria o Seguro de caución");
  assert.equal(r["Para entrar"], "1 mes de depósito + 1 mes por adelantado");
  assert.equal(r["Contrato"], "2 años");
  assert.equal(r["Ajuste"], "Por IPC");
  assert.equal(r["Expensas"], "$ 45.000 por mes");
  assert.equal(r["Paga el inquilino"], "Luz y agua");
  assert.match(r["Disponible"] ?? "", /^Desde el 1 de marzo/);
  assert.deepEqual(etiquetasCondiciones(c), ["Acepta caución", "Con mascotas"]);
});
