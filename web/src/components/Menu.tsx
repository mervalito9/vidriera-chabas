import { useEffect, useRef } from "react";
import { WA_NUMERO } from "../../../shared/config.ts";
import { linkWA } from "../../../shared/whatsapp.ts";
import { ir } from "../router.ts";

const SECCIONES: [string, [string, string][]][] = [
  ["Buscar", [["inmuebles--alquiler", "Alquileres"], ["inmuebles--venta", "Casas y terrenos en venta"], ["vehiculos", "Autos, camionetas y motos"], ["buscar", "Todos los avisos"]]],
  ["Vidriera", [["busco", "Avisame cuando aparezca"], ["como-funciona", "Cómo funciona"], ["preguntas", "Preguntas frecuentes"]]],
];

/** Botón ☰ y menú lateral con todas las secciones (el clásico de cualquier sitio en el celular). */
export function Menu({ ruta }: { ruta: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const abrir = () => dialogo.current?.showModal();
  const cerrar = () => dialogo.current?.close();
  // Al ir a otra pantalla (tocando una opción, o con "atrás"), el menú se cierra.
  useEffect(() => {
    const cambio = () => cerrar();
    window.addEventListener("hashchange", cambio);
    return () => window.removeEventListener("hashchange", cambio);
  }, []);
  const actual = (k: string) => (k === ruta ? "page" : undefined);

  return (
    <>
      <button type="button" className="menu-btn" aria-label="Abrir el menú" aria-haspopup="dialog" onClick={abrir}>
        <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
      </button>
      {/* Tocar afuera del panel (el fondo oscuro) también cierra */}
      <dialog ref={dialogo} className="menu" aria-label="Menú" onClick={(e) => { if (e.target === dialogo.current) cerrar(); }}>
        <div className="menu-in">
          <div className="menu-cab">
            <a href={ir("inicio")} className="menu-inicio" aria-current={actual("inicio")}>Inicio</a>
            <button type="button" className="menu-x" aria-label="Cerrar el menú" onClick={cerrar}>×</button>
          </div>
          <a className="btn btn-main menu-publicar" href={ir("publicar")}>Publicar gratis</a>
          {SECCIONES.map(([titulo, links]) => (
            <nav key={titulo} aria-label={titulo}>
              <p className="menu-t">{titulo}</p>
              {links.map(([k, t]) => <a key={k} href={`#${k}`} aria-current={actual(k)}>{t}</a>)}
            </nav>
          ))}
          <a className="btn btn-wa menu-wa" target="_blank" rel="noopener noreferrer" href={linkWA(WA_NUMERO, "Hola Felipe! Te escribo por Vidriera Chabás.")}>Escribinos por WhatsApp</a>
          <p className="menu-pie"><a href={ir("terminos")}>Términos</a> · <a href={ir("privacidad")}>Privacidad</a></p>
        </div>
      </dialog>
    </>
  );
}
