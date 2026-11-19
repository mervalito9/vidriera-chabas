// Piezas que comparten todas las secciones del panel.
import { useState, type ReactNode } from "react";

/** Secciones del panel; cada una tiene su dirección (#admin--avisos). */
export type Seccion = "inicio" | "avisos" | "cargar" | "varios" | "busquedas" | "estad" | "actividad" | "mas";
/** Corre un cambio contra el servidor, muestra el error si falla y recarga los datos del panel. */
export type Accion = (fn: () => Promise<unknown>) => Promise<void>;

export const mensajeError = (e: unknown) => (e instanceof Error ? e.message : "Algo salió mal.");
export const DIA = 864e5;
export const diasHasta = (iso: string) => Math.ceil((Date.parse(iso) - Date.now()) / DIA);
export const esNueva = (iso: string) => Date.now() - Date.parse(iso) < 7 * DIA;


// ---------- Íconos (trazo, heredan el color del texto) ----------
export const I = {
  inicio: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  avisos: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></>,
  mas: <path d="M12 5v14M5 12h14" />,
  buscar: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  estad: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  actividad: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  puntos: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  bajar: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  salir: <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />,
  afuera: <path d="M7 17L17 7M8 7h9v9" />,
  zip: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M10 12h2M10 15h2M10 18h2" /></>,
};
export const Ico = ({ d, size = 20 }: { d: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const Logo = () => <span className="pn-logo"><b>Vidriera</b> <i>Chabás</i></span>;

export const Titulo = ({ t, children }: { t: string; children?: ReactNode }) => (
  <div className="pn-titulo"><h1>{t}</h1>{children}</div>
);

/** Borrar/Rechazar pide una segunda confirmación en la misma pantalla. */
export function Confirmar({ texto, onSi, chico }: { texto: string; onSi: () => void; chico?: boolean }) {
  const [preguntando, setPreguntando] = useState(false);
  return preguntando ? (
    <span className="pn-confirmar">¿Seguro?
      <button type="button" className="pn-btn pn-btn-peligro pn-btn-chico" onClick={onSi}>Sí</button>
      <button type="button" className="pn-linkbtn" onClick={() => setPreguntando(false)}>No</button>
    </span>
  ) : (
    <button type="button" className={`pn-linkbtn${chico ? " chico" : ""}`} onClick={() => setPreguntando(true)}>{texto}</button>
  );
}
