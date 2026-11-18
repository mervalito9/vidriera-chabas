import { useEffect, useRef, useState, type DependencyList, type RefObject } from "react";

/** Cambia el título de la pestaña. */
export function useTitulo(titulo: string): void {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Vidriera Chabás` : "Vidriera Chabás · Casas, autos y más de Chabás y la zona";
  }, [titulo]);
}

export type Carga<T> = { estado: "cargando" } | { estado: "listo"; datos: T } | { estado: "error"; mensaje: string };

/** Ejecuta una carga asíncrona y descarta resultados viejos si cambian las dependencias. */
export function useCarga<T>(fn: () => Promise<T>, deps: DependencyList): Carga<T> {
  const [c, setC] = useState<Carga<T>>({ estado: "cargando" });
  useEffect(() => {
    let vigente = true;
    setC({ estado: "cargando" });
    fn().then(
      (datos) => vigente && setC({ estado: "listo", datos }),
      (e: unknown) => vigente && setC({ estado: "error", mensaje: e instanceof Error ? e.message : "Algo salió mal." }),
    );
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return c;
}

const calma = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Agrega la clase "reveal" y después "in" cuando el bloque entra en pantalla (salvo "reducir movimiento"). */
export function useAparecer<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || calma() || !("IntersectionObserver" in window)) return;
    el.classList.add("reveal");
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
