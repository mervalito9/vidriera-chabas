// Armazón del panel: menú al costado en la compu, barra abajo en el celular.
import { clientesDe } from "../components/form/Cliente.tsx";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AvisoAdmin, Busqueda } from "../../../shared/tipos.ts";
import { ErrorApi, admin } from "../api.ts";
import { Cargando } from "../components/Tarjeta.tsx";
import { useTitulo } from "../hooks.ts";
import { ir, navegar } from "../router.ts";
import { Actividad } from "./Actividad.tsx";
import { Avisos } from "./Avisos.tsx";
import { Busquedas } from "./Busquedas.tsx";
import { I, Ico, Logo, Titulo, esNueva, mensajeError, type Seccion } from "./comunes.tsx";
import { CargarSeccion, Editor } from "./Editor.tsx";
import { Estadisticas } from "./Estadisticas.tsx";
import { Inicio } from "./Inicio.tsx";

// ---------- Armazón: menú + contenido ----------

export function Panel({ param, onSalir }: { param: string; onSalir: () => void }) {
  const editarId = /^editar-(\d+)$/.exec(param)?.[1];
  const seccion: Seccion = editarId ? "avisos" : (["inicio", "avisos", "cargar", "varios", "busquedas", "estad", "actividad", "mas"] as const).find((s) => s === param) ?? "inicio";
  const [avisos, setAvisos] = useState<AvisoAdmin[] | null>(null);
  const [busquedas, setBusquedas] = useState<Busqueda[] | null>(null);
  const [vivo, setVivo] = useState<number | null>(null);
  const [error, setError] = useState("");

  const fallo = useCallback((e: unknown) => {
    if (e instanceof ErrorApi && e.status === 401) onSalir();
    else setError(mensajeError(e));
  }, [onSalir]);
  const recargar = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([admin.avisos(""), admin.busquedas()]);
      setAvisos(a.filter((x) => !x.ejemplo));
      setBusquedas(b);
      setError("");
    } catch (e) { fallo(e); }
  }, [fallo]);
  useEffect(() => { void recargar(); }, [recargar]);
  // Gente en línea, para el puntito verde del menú
  useEffect(() => {
    const traer = () => { if (document.visibilityState === "visible") admin.actividad("24h").then((d) => setVivo(d.enVivo.total), () => {}); };
    traer();
    const t = window.setInterval(traer, 30_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [param]);

  const accion = useCallback(async (fn: () => Promise<unknown>) => {
    setError("");
    try { await fn(); await recargar(); } catch (e) { fallo(e); }
  }, [recargar, fallo]);

  // Clientes guardados: salen de los avisos ya cargados (se eligen de una lista al cargar uno nuevo).
  const clientes = useMemo(() => clientesDe(avisos ?? []), [avisos]);
  const pendientes = avisos?.filter((a) => a.estado === "pendiente").length ?? 0;
  const nuevas = busquedas?.filter((b) => esNueva(b.creadoEn)).length ?? 0;
  const salir = () => void admin.salir().finally(onSalir);
  const aviso = editarId && avisos ? avisos.find((a) => a.id === Number(editarId)) : undefined;
  const NOMBRES: Record<Seccion, string> = { inicio: "Inicio", avisos: "Avisos", cargar: "Cargar aviso", varios: "Cargar varios", busquedas: "Búsquedas", estad: "Estadísticas", actividad: "Actividad", mas: "Más" };
  useTitulo(aviso ? `Editar · ${aviso.titulo} · Panel` : `${NOMBRES[seccion]} · Panel`);

  const items: [Seccion, string, ReactNode, ReactNode?][] = [
    ["inicio", "Inicio", I.inicio],
    ["avisos", "Avisos", I.avisos, pendientes > 0 ? <span className="pn-num">{pendientes}</span> : null],
    ["cargar", "Cargar avisos", I.mas],
    ["busquedas", "Búsquedas", I.buscar, nuevas > 0 ? <span className="pn-sub">{nuevas} {nuevas === 1 ? "nueva" : "nuevas"}</span> : null],
    ["estad", "Estadísticas", I.estad],
    ["actividad", "Actividad", I.actividad, vivo ? <span className="pn-vivo"><i />{vivo}</span> : null],
  ];
  const activo = (s: Seccion) => s === seccion || (s === "cargar" && seccion === "varios");

  return (
    <div className="pn" data-clarity-mask="True">
      <aside className="pn-lado">
        <a className="pn-marca" href={ir("admin", "inicio")}><Logo /><span className="pn-etq">PANEL</span></a>
        <nav aria-label="Panel" className="pn-menu">
          {items.map(([s, t, ico, extra]) => (
            <a key={s} href={ir("admin", s)} aria-current={activo(s) ? "page" : undefined}><Ico d={ico} />{t}{extra}</a>
          ))}
        </nav>
        <div className="pn-menu pn-menu-pie">
          <a href={ir("inicio")} target="_blank" rel="noopener"><Ico d={I.afuera} size={18} />Ver el sitio</a>
          <a href="api/admin/copia" download><Ico d={I.bajar} size={18} />Copia de seguridad</a>
          <button type="button" onClick={salir}><Ico d={I.salir} size={18} />Salir</button>
        </div>
      </aside>

      <header className="pn-arriba">
        <Logo />
        {vivo ? <a className="pn-vivo-pill" href={ir("admin", "actividad")}><i />{vivo} ahora</a> : null}
      </header>

      <div className="pn-cont">
        {error && <p className="form-err" role="alert">{error}</p>}
        {editarId ? (
          !avisos ? <Cargando /> : aviso ? <Editor key={aviso.id} a={aviso} accion={accion} clientes={clientes} onListo={() => { void recargar(); navegar(ir("admin", "avisos")); }} /> : <p>Ese aviso ya no existe. <a href={ir("admin", "avisos")}>Volver a avisos</a></p>
        ) : seccion === "inicio" ? (
          <Inicio avisos={avisos} busquedas={busquedas} accion={accion} />
        ) : seccion === "avisos" ? (
          avisos ? <Avisos avisos={avisos} accion={accion} /> : <Cargando />
        ) : seccion === "cargar" || seccion === "varios" ? (
          <CargarSeccion varios={seccion === "varios"} clientes={clientes} onListo={() => { void recargar(); navegar(ir("admin", "avisos")); }} />
        ) : seccion === "busquedas" ? (
          <Busquedas busquedas={busquedas} accion={accion} />
        ) : seccion === "estad" ? (
          <><Titulo t="Estadísticas" /><Estadisticas pendientes={pendientes} irPendientes={() => navegar(ir("admin", "avisos"))} /></>
        ) : seccion === "actividad" ? (
          <><Titulo t="Actividad" /><Actividad /></>
        ) : (
          <Mas items={items} salir={salir} />
        )}
      </div>

      <nav className="pn-abajo" aria-label="Panel">
        <a href={ir("admin", "inicio")} aria-current={seccion === "inicio" ? "page" : undefined}><Ico d={I.inicio} size={22} />Inicio</a>
        <a href={ir("admin", "avisos")} aria-current={seccion === "avisos" ? "page" : undefined}><Ico d={I.avisos} size={22} />Avisos{pendientes > 0 && <span className="pn-num">{pendientes}</span>}</a>
        <a href={ir("admin", "cargar")} className="pn-abajo-mas" aria-label="Cargar aviso"><span><Ico d={I.mas} size={26} /></span></a>
        <a href={ir("admin", "estad")} aria-current={seccion === "estad" ? "page" : undefined}><Ico d={I.estad} size={22} />Números</a>
        <a href={ir("admin", "mas")} aria-current={["mas", "busquedas", "actividad"].includes(seccion) ? "page" : undefined}><Ico d={I.puntos} size={22} />Más{nuevas > 0 && <span className="pn-num">{nuevas}</span>}</a>
      </nav>
    </div>
  );
}

export function Mas({ items, salir }: { items: [Seccion, string, ReactNode, ReactNode?][]; salir: () => void }) {
  return (
    <>
      <Titulo t="Más" />
      <div className="pn-caja pn-lista-mas">
        {items.filter(([s]) => ["busquedas", "actividad", "estad"].includes(s)).map(([s, t, ico, extra]) => <a key={s} href={ir("admin", s)}><Ico d={ico} />{t}{extra}</a>)}
        <a href={ir("admin", "varios")}><Ico d={I.zip} />Cargar varios (.zip)</a>
        <a href={ir("inicio")} target="_blank" rel="noopener"><Ico d={I.afuera} />Ver el sitio</a>
        <a href="api/admin/copia" download><Ico d={I.bajar} />Copia de seguridad</a>
        <button type="button" onClick={salir}><Ico d={I.salir} />Salir</button>
      </div>
    </>
  );
}
