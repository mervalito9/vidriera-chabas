import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { PUEBLOS, RUBROS } from "../../shared/config.ts";
import { slug } from "../../shared/texto.ts";
import type { RubroId } from "../../shared/tipos.ts";
import { listarAvisos } from "./api.ts";
import { Marco } from "./components/Marco.tsx";
import { SeBuscanPagina } from "./components/SeBuscan.tsx";
import { Aviso } from "./pages/Aviso.tsx";
import { Busco } from "./pages/Busco.tsx";
import { Inicio } from "./pages/Inicio.tsx";
import { Listado } from "./pages/Listado.tsx";
import { Publicar } from "./pages/Publicar.tsx";
import { ComoFunciona, NoEncontrado, PreguntasFrecuentes, Privacidad, Terminos } from "./pages/Textos.tsx";
import { leerRuta, salirDePantalla, useRuta, type Ruta } from "./router.ts";
import { medirPagina } from "./medir.ts";
import { Cargando } from "./components/Tarjeta.tsx";
import { SE_BUSCAN_ACTIVO } from "./seBuscan.ts";

declare const __PANEL_CSS__: string;

/** Agrega una hoja de estilos y espera a que esté lista (así el panel no aparece un instante sin diseño). */
function cargarEstilos(href: string): Promise<void> {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((listo) => {
    const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href });
    link.onload = link.onerror = () => listo();
    document.head.append(link);
  });
}

// El panel solo lo usa Felipe: su código y sus estilos se bajan aparte, así los visitantes no los cargan.
const Admin = lazy(() =>
  Promise.all([import("./panel/index.tsx"), cargarEstilos(__PANEL_CSS__)]).then(([m]) => ({ default: m.Admin })),
);

function Pagina({ ruta }: { ruta: Ruta }) {
  const { nombre, param } = ruta;
  if (nombre === "inicio") return <Inicio />;
  if (nombre === "buscar") return <Listado key="todo" rubro="" atajo={param} />;
  if (nombre in RUBROS) return <Listado key={nombre} rubro={nombre as RubroId} atajo={param} />;
  if (nombre === "aviso" && /^\d+$/.test(param)) return <Aviso key={param} id={Number(param)} />;
  if (nombre === "publicar") return <Publicar key={param} rubro={param} />;
  if (nombre === "busco") return <Busco />;
  if (nombre === "se-buscan" && SE_BUSCAN_ACTIVO) return <SeBuscanPagina />;
  if (nombre === "como-funciona") return <ComoFunciona />;
  if (nombre === "preguntas") return <PreguntasFrecuentes />;
  if (nombre === "terminos") return <Terminos />;
  if (nombre === "privacidad") return <Privacidad />;
  // #pueblo--sanford: el listado de toda la zona con el filtro de ese pueblo puesto (#pueblo--otro = pueblos fuera de la lista)
  if (nombre === "pueblo") {
    const p = param === "otro" ? "otro" : (PUEBLOS.find((x) => slug(x) === param) ?? "");
    return <Listado key={`pueblo-${p}`} rubro="" atajo="" pueblo={p} />;
  }
  if (nombre === "admin") return <Suspense fallback={<div className="pn-centro"><Cargando /></div>}><Admin param={param} /></Suspense>;
  return <NoEncontrado />;
}

const claveDePantalla = ({ nombre, param }: Ruta): string =>
  nombre === "admin" ? "admin" : nombre in RUBROS || nombre === "buscar" ? nombre : `${nombre}--${param}`;

export function App() {
  const ruta = useRuta();
  const [soloEjemplos, setSoloEjemplos] = useState(false);
  useEffect(() => medirPagina(ruta.nombre, ruta.param), [ruta.nombre, ruta.param]);
  useEffect(() => {
    listarAvisos({}, 1).then((l) => setSoloEjemplos(l.soloEjemplos && l.total > 0), () => setSoloEjemplos(false));
  }, []);
  // Al tocar un link a otra pantalla: la actual se va hacia la izquierda y recién ahí se cambia (como en una app).
  const clave = useRef("");
  clave.current = claveDePantalla(ruta);
  useEffect(() => {
    const alTocar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href^='#']");
      const destino = link?.getAttribute("href");
      if (!link || !destino || link.getAttribute("target")) return;
      if (claveDePantalla(leerRuta(destino)) === clave.current) return;
      if (salirDePantalla("adelante", () => { window.location.hash = destino; })) e.preventDefault();
    };
    document.addEventListener("click", alTocar);
    return () => document.removeEventListener("click", alTocar);
  }, []);
  return (
    <Marco ruta={ruta.nombre} soloEjemplos={soloEjemplos}>
      {/* Cada pantalla nueva entra con un fundido corto (la clave cambia → se vuelve a animar).
          Un listado mantiene su clave al cambiar de atajo, para no perder los filtros. */}
      <div className="pantalla" key={claveDePantalla(ruta)}>
        <Pagina ruta={ruta} />
      </div>
    </Marco>
  );
}
