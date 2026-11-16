import type { Pueblo, Rubro, RubroId } from "./tipos.ts";

/**
 * WhatsApp que recibe los avisos para publicar, los "Avisame cuando aparezca"
 * y los pedidos de pueblos nuevos. Solo números: 549 + código de área sin 0 + número sin 15.
 * Si queda vacío (""), el sitio muestra "Falta configurar el WhatsApp" en vez de un link roto.
 */
export const WA_NUMERO = "5493464593621";

export const DIAS_VIGENCIA = 90;
export const POR_PAGINA = 12;

/** Límites de los formularios. El backend los vuelve a controlar siempre. */
export const LIMITES = {
  titulo: 80,
  descripcion: 1000,
  nombre: 40,
  fotos: 8,
  /** tamaño máximo de cada foto ya achicada, en bytes */
  fotoBytes: 2_500_000,
  /** lado más largo al que se achican las fotos en el navegador */
  fotoLado: 1600,
} as const;

export const RUBROS: Record<RubroId, Rubro> = {
  inmuebles: {
    id: "inmuebles",
    nombre: "Inmuebles",
    ruta: "inmuebles",
    descripcion: "Casas, departamentos, terrenos, alquileres, galpones y locales.",
    resumen: "Casas, alquileres, terrenos",
    tipos: ["Casa", "Departamento", "Terreno", "Galpón o local"],
    placeholder: "Ej: Casa de 2 dormitorios con patio",
  },
  vehiculos: {
    id: "vehiculos",
    nombre: "Vehículos",
    ruta: "vehiculos",
    descripcion: "Autos, camionetas, utilitarios, motos, camiones y acoplados.",
    resumen: "Autos, camionetas, motos",
    tipos: ["Auto", "Camioneta o utilitario", "Moto", "Camión o acoplado"],
    placeholder: "Ej: Volkswagen Gol 2015",
  },
  agro: {
    id: "agro",
    nombre: "Maquinaria agro",
    ruta: "agro",
    descripcion: "Tractores, cosechadoras, sembradoras, pulverizadoras, tolvas y herramientas.",
    resumen: "Tractores, herramientas",
    tipos: ["Tractor", "Cosechadora", "Sembradora", "Pulverizadora", "Tolva o acoplado", "Herramientas", "Otra máquina"],
    placeholder: "Ej: Tractor 110 HP 2016 con pala",
  },
};

export const RUBRO_IDS = Object.keys(RUBROS) as RubroId[];

/** Pueblos que todavía no están activos: se muestran como "Próximamente". */
export const PUEBLOS_PROXIMOS: readonly Pueblo[] = [
  { slug: "casilda", nombre: "Casilda" },
  { slug: "firmat", nombre: "Firmat" },
  { slug: "sanford", nombre: "Sanford" },
  { slug: "villada", nombre: "Villada" },
  { slug: "arequito", nombre: "Arequito" },
  { slug: "otro", nombre: "Otro pueblo" },
];

/** Botones rápidos de cada listado. La clave es "alquiler", "venta" o el tipo en minúsculas sin tildes. */
export const ATAJOS: Record<RubroId | "todo", ReadonlyArray<readonly [string, string]>> = {
  todo: [["alquiler", "Alquileres"], ["casa", "Casas"], ["auto", "Autos"], ["moto", "Motos"], ["tractor", "Tractores"]],
  inmuebles: [["alquiler", "Alquileres"], ["venta", "En venta"], ["casa", "Casas"], ["departamento", "Departamentos"], ["terreno", "Terrenos"], ["galpon-o-local", "Galpones y locales"]],
  vehiculos: [["auto", "Autos"], ["camioneta-o-utilitario", "Camionetas y utilitarios"], ["moto", "Motos"], ["camion-o-acoplado", "Camiones y acoplados"]],
  agro: [["tractor", "Tractores"], ["cosechadora", "Cosechadoras"], ["sembradora", "Sembradoras"], ["tolva-o-acoplado", "Tolvas y acoplados"], ["herramientas", "Herramientas"]],
};
