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

// ---------- Volver a donde estabas ----------
// Cada pantalla del historial lleva un número en history.state. Al ir "atrás" o "adelante" el número ya existe,
// y se vuelve a la altura en que la persona la dejó. Una pantalla nueva arranca arriba.
const alturas = new Map<number, number>();
let siguiente = 1;
let pantallaActual = 0;
let restaurando = 0;

/** Número de la pantalla actual; si es nueva, se lo pone. Devuelve también si ya existía (= se volvió a ella). */
function marcarPantalla(): { numero: number; vuelta: boolean } {
  const previo = (window.history.state as { pantalla?: unknown } | null)?.pantalla;
  if (typeof previo === "number") {
    siguiente = Math.max(siguiente, previo + 1);
    return { numero: previo, vuelta: true };
  }
  const numero = siguiente++;
  window.history.replaceState({ ...(window.history.state as object | null), pantalla: numero }, "");
  return { numero, vuelta: false };
}

/** Va a la altura guardada. La página puede estar cargando todavía: reintenta hasta 1,5 s o hasta que la persona toque. */
function irAAltura(y: number): void {
  cancelAnimationFrame(restaurando);
  window.scrollTo(0, y);
  const hasta = performance.now() + 1500;
  const soltar = () => cancelAnimationFrame(restaurando);
  window.addEventListener("touchstart", soltar, { once: true, passive: true });
  window.addEventListener("wheel", soltar, { once: true, passive: true });
  const intentar = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max >= y - 2) return void window.scrollTo(0, y);
    window.scrollTo(0, max);
    if (performance.now() < hasta) restaurando = requestAnimationFrame(intentar);
  };
  restaurando = requestAnimationFrame(intentar);
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(() => leerRuta(window.location.hash));
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    pantallaActual = marcarPantalla().numero;
    const mostrar = () => {
      alturas.set(pantallaActual, window.scrollY);
      const { numero, vuelta } = marcarPantalla();
      pantallaActual = numero;
      setRuta(leerRuta(window.location.hash));
      const y = vuelta ? alturas.get(numero) : undefined;
      if (y) irAAltura(y);
      else {
        cancelAnimationFrame(restaurando);
        window.scrollTo(0, 0);
      }
    };
    // La animación de entrada de cada pantalla la hace App (ver .pantalla en style.css).
    const cambio = () => mostrar();
    window.addEventListener("hashchange", cambio);
    return () => window.removeEventListener("hashchange", cambio);
  }, []);
  return ruta;
}

export function navegar(hash: string): void {
  window.location.hash = hash;
}
