// Microsoft Clarity: grabaciones de cómo se mueve la gente y mapas de calor (clarity.microsoft.com).
// Se carga solo si hay CLARITY_ID, nunca en la vista previa, y nunca para quien usa el panel (Felipe no se graba a sí mismo).
// El código oficial de Clarity es un <script> suelto que la CSP del sitio no deja correr: acá se hace lo mismo desde app.js.
import { CLARITY_ID } from "../../shared/config.ts";

declare const __VISTA_PREVIA__: boolean;
type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global {
  interface Window { clarity?: Clarity }
}

const SIN_CLARITY = "vidriera-sin-clarity";
let cargado = false;

const esDelPanel = (): boolean => {
  try {
    return window.localStorage.getItem(SIN_CLARITY) === "1";
  } catch {
    return false;
  }
};

/** Quien entra al panel deja de grabarse en este navegador (y lo que ya se cargó, se corta). */
export function marcarComoPanel(): void {
  try {
    window.localStorage.setItem(SIN_CLARITY, "1");
  } catch { /* sin almacenamiento: igual no se carga en el panel */ }
  window.clarity?.("stop");
}

function cargar(): void {
  if (cargado || !CLARITY_ID || __VISTA_PREVIA__ || esDelPanel()) return;
  cargado = true;
  const cola: Clarity = (...args: unknown[]) => { (cola.q ??= []).push(args); };
  window.clarity ??= cola;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${encodeURIComponent(CLARITY_ID)}`;
  document.head.append(s);
}

/** En cada cambio de pantalla: etiqueta la grabación con la pantalla (inicio, aviso, publicar…) para filtrar después. */
export function clarityPantalla(nombre: string): void {
  if (nombre === "admin") return marcarComoPanel();
  cargar();
  window.clarity?.("set", "pantalla", nombre);
}
