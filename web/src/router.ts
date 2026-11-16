import { useEffect, useState } from "react";

/**
 * Rutas por "#": funcionan en cualquier hosting y en la vista previa, sin configurar nada.
 * Formato: #nombre o #nombre--parametro   (ej: #aviso--12, #vehiculos--moto, #publicar--agro)
 */
export interface Ruta {
  nombre: string;
  param: string;
}

export function leerRuta(hash: string): Ruta {
  let s = hash.replace(/^#/, "");
  try {
    s = decodeURIComponent(s);
  } catch {
    s = "";
  }
  const [nombre = "", param = ""] = s.split("--");
  return { nombre: nombre || "inicio", param };
}

export const ir = (nombre: string, param?: string | number): string =>
  `#${nombre}${param !== undefined && param !== "" ? `--${param}` : ""}`;

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(() => leerRuta(window.location.hash));
  useEffect(() => {
    const cambio = () => {
      setRuta(leerRuta(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", cambio);
    return () => window.removeEventListener("hashchange", cambio);
  }, []);
  return ruta;
}

export function navegar(hash: string): void {
  window.location.hash = hash;
}
