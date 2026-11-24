import type { Rubro, RubroId } from "./tipos.ts";

/**
 * WhatsApp que recibe los avisos para publicar y los "Avisame cuando aparezca". Solo números: 549 + código de área sin 0 + número sin 15.
 * Si queda vacío (""), el sitio muestra "Falta configurar el WhatsApp" en vez de un link roto.
 */
export const WA_NUMERO = "5493464626380";

export const DIAS_VIGENCIA = 90;
/** Cuánto tiempo se muestra una búsqueda en «Se buscan», salvo que se renueve desde el panel. */
export const DIAS_SE_BUSCAN = 30;
export const POR_PAGINA = 12;

/** Límites de los formularios. El backend los vuelve a controlar siempre. */
export const LIMITES = {
  titulo: 80,
  descripcion: 1000,
  nombre: 40,
  anunciante: 60,
  fotos: 8,
  /** tamaño máximo de cada foto ya achicada, en bytes */
  fotoBytes: 1_200_000,
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

/**
 * Pueblos de la zona. Es la única lista: de acá salen el filtro de pueblo y el campo "¿Dónde está?" al publicar.
 * Chabás va primero (es el pueblo principal). Para sumar un pueblo, agregá su nombre al final y subí el cambio.
 * "Otro" se agrega solo: es para avisos de pueblos que no están en la lista.
 */
export const PUEBLOS: readonly string[] = ["Chabás", "Casilda", "Firmat", "Sanford", "Villada"];

/** Microsoft Clarity (grabaciones y mapas de calor). Vacío = apagado. Es público: va en la página. */
export const CLARITY_ID = "";

/** Centro de cada pueblo (lat, lng), para el mapa. */
export const COORDENADAS: Readonly<Record<string, readonly [number, number]>> = {
  Chabás: [-33.2457, -61.358],
  Casilda: [-33.0442, -61.1681],
  Firmat: [-33.4555, -61.4883],
  Sanford: [-33.147, -61.277],
  Villada: [-33.3487, -61.4459],
};
/** Dónde arranca el mapa cuando no hay un pueblo elegido: entre los cinco, para ver toda la zona. */
export const CENTRO_ZONA: readonly [number, number] = [-33.25, -61.33];

/** Valor del filtro para "Otro": avisos de pueblos que no están en PUEBLOS. */
export const OTRO_PUEBLO = "otro";

/** Nombre para mostrar del lugar que se está filtrando. */
export const lugarDe = (pueblo: string): string =>
  !pueblo ? "Chabás y la zona" : pueblo === OTRO_PUEBLO ? "otros pueblos de la zona" : pueblo;

/** Botones rápidos de cada listado. La clave es "alquiler", "venta" o el tipo en minúsculas sin tildes. */
export const ATAJOS: Record<RubroId | "todo", ReadonlyArray<readonly [string, string]>> = {
  todo: [["alquiler", "Alquileres"], ["casa", "Casas"], ["auto", "Autos"], ["moto", "Motos"], ["tractor", "Tractores"]],
  inmuebles: [["alquiler", "Alquileres"], ["venta", "En venta"], ["casa", "Casas"], ["departamento", "Departamentos"], ["terreno", "Terrenos"], ["galpon-o-local", "Galpones y locales"]],
  vehiculos: [["auto", "Autos"], ["camioneta-o-utilitario", "Camionetas y utilitarios"], ["moto", "Motos"], ["camion-o-acoplado", "Camiones y acoplados"]],
  agro: [["tractor", "Tractores"], ["cosechadora", "Cosechadoras"], ["sembradora", "Sembradoras"], ["tolva-o-acoplado", "Tolvas y acoplados"], ["herramientas", "Herramientas"]],
};
