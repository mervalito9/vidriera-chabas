import { useRef, type ReactNode } from "react";
import { ir, navegar } from "../router.ts";

const NAV = [
  ["inmuebles", "Inmuebles"],
  ["vehiculos", "Vehículos"],
  ["como-funciona", "Cómo funciona"],
] as const;

/** Encabezado, botón Volver y pie: lo que comparten todas las páginas. */
export function Marco({ ruta, soloEjemplos, children }: { ruta: string; soloEjemplos: boolean; children: ReactNode }) {
  const main = useRef<HTMLElement>(null);
  const esInicio = ruta === "inicio";
  const volver = () => (window.history.length > 1 ? window.history.back() : navegar(ir("inicio")));

  return (
    <>
      <button type="button" className="skip" onClick={() => main.current?.focus()}>Saltar al contenido</button>
      <header className="top">
        <div className="wrap">
          <a className="logo" href={ir("inicio")}>
            <img src="assets/img/logo-horizontal-claro.svg" alt="Vidriera Chabás, ir al inicio" width={188} height={40} />
            <span className="firma">por Felipe Sancho</span>
          </a>
          <nav className="nav" aria-label="Principal">
            {NAV.map(([k, t]) => (
              <a key={k} href={ir(k)} aria-current={ruta === k ? "page" : undefined}>{t}</a>
            ))}
          </nav>
          <span className="spacer" />
          <a className="btn btn-main" href={ir("publicar")}>Publicar gratis</a>
        </div>
        {!esInicio && (
          <nav className="subnav wrap" aria-label="Accesos rápidos">
            <a href={ir("inicio")}>Inicio</a>
            <a href={ir("buscar")} aria-current={ruta === "buscar" ? "page" : undefined}>Buscar</a>
            <a href={ir("publicar")} aria-current={ruta === "publicar" ? "page" : undefined}>Publicar gratis</a>
          </nav>
        )}
      </header>
      <main id="contenido" ref={main} tabIndex={-1}>
        {!esInicio && (
          <div className="wrap volver-row">
            <button type="button" className="volver" onClick={volver}>← Volver</button>
          </div>
        )}
        {children}
      </main>
      <footer>
        <div className="wrap">
          <a href={ir("inicio")}><img src="assets/img/logo-horizontal-oscuro.svg" alt="Vidriera Chabás" width={178} height={38} /></a>
          <div>
            <p className="firma-pie">Hecho en Chabás por Felipe Sancho.</p>
            <p>Vidriera Chabás es un tablón de avisos clasificados de Chabás y la zona. No intermedia en las operaciones ni cobra comisión sobre ventas o alquileres. Cada aviso es responsabilidad de quien lo publica.</p>
            <nav aria-label="Pie de página">
              <a href={ir("publicar")}>Publicar gratis</a>
              <a href={ir("busco")}>Avisame cuando aparezca</a>
              <a href={ir("como-funciona")}>Cómo funciona</a>
              <a href={ir("terminos")}>Términos</a>
              <a href={ir("privacidad")}>Privacidad</a>
            </nav>
          </div>
          {soloEjemplos && <p className="legal">Sitio recién lanzado: los avisos marcados "Ejemplo" son de muestra.</p>}
        </div>
      </footer>
    </>
  );
}
