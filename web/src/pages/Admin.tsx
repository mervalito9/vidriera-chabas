// Panel de Vidriera Chabás: menú lateral en la compu y barra de abajo en el celular.
// Secciones por dirección (#admin--avisos, #admin--editar-12…), así el botón "atrás" funciona.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { OTRO_PUEBLO, PUEBLOS, RUBROS } from "../../../shared/config.ts";
import { fmtFecha, fmtNum, soloDigitos } from "../../../shared/texto.ts";
import type { AvisoAdmin, AvisoPublico, Busqueda, ErrorCampo, NuevoAviso, RubroId } from "../../../shared/tipos.ts";
import { linkWA } from "../../../shared/whatsapp.ts";
import type { Resumen } from "../../../server/estad.ts";
import type { Actividad as DatosActividad } from "../../../server/actividad.ts";
import { ErrorApi, admin, conServidor } from "../api.ts";
import { FormAviso, valoresIniciales, type ValoresForm } from "../components/FormAviso.tsx";
import { Cargando, Tarjeta } from "../components/Tarjeta.tsx";
import { CargarVarios } from "./Lote.tsx";
import { Estadisticas } from "./Estadisticas.tsx";
import { Actividad } from "./Actividad.tsx";
import { fotoSegura, precioTexto } from "../formato.ts";
import { useCarga, useTitulo } from "../hooks.ts";
import { tarjetaRedes, textoRedes } from "../redes.ts";
import { ir, navegar } from "../router.ts";

type Seccion = "inicio" | "avisos" | "cargar" | "varios" | "busquedas" | "estad" | "actividad" | "mas";
const mensajeError = (e: unknown) => (e instanceof Error ? e.message : "Algo salió mal.");
const DIA = 864e5;
const diasHasta = (iso: string) => Math.ceil((Date.parse(iso) - Date.now()) / DIA);

// ---------- Íconos (trazo, heredan el color del texto) ----------
const I = {
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
const Ico = ({ d, size = 20 }: { d: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const Logo = () => <span className="pn-logo"><b>Vidriera</b> <i>Chabás</i></span>;

export function Admin({ param = "" }: { param?: string }) {
  useTitulo("Panel");
  const servidor = useCarga(() => conServidor(), []);
  const [sesion, setSesion] = useState<"?" | "si" | "no">("?");
  useEffect(() => {
    if (servidor.estado !== "listo" || !servidor.datos) return;
    admin.sesion().then((r) => setSesion(r.ok ? "si" : "no"), () => setSesion("no"));
  }, [servidor]);

  if (servidor.estado === "cargando" || (servidor.estado === "listo" && servidor.datos && sesion === "?")) return <div className="pn-centro"><Cargando /></div>;
  if (servidor.estado !== "listo" || !servidor.datos)
    return <div className="pn-centro"><div className="pn-login"><Logo /><p>El panel funciona cuando el sitio está corriendo en su servidor. En esta vista previa no hay base de datos.</p></div></div>;
  if (sesion === "no") return <Login onEntrar={() => setSesion("si")} />;
  return <Panel param={param} onSalir={() => setSesion("no")} />;
}

function Login({ onEntrar }: { onEntrar: () => void }) {
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      await admin.entrar(clave);
      setClave("");
      onEntrar();
    } catch (x) {
      setError(mensajeError(x));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="pn-centro">
      <form className="pn-login" onSubmit={(e) => void entrar(e)}>
        <Logo />
        <h1>Panel</h1>
        <label className="pn-campo">
          <span>Contraseña</span>
          <span className="pn-clave">
            <input type={ver ? "text" : "password"} autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} autoFocus />
            <button type="button" className="pn-linkbtn" onClick={() => setVer(!ver)}>{ver ? "Ocultar" : "Ver"}</button>
          </span>
        </label>
        {error && <p className="form-err" role="alert">{error}</p>}
        <button className="pn-btn pn-btn-main pn-btn-xl" type="submit" disabled={enviando || !clave}>{enviando ? "Entrando…" : "Entrar"}</button>
        <a className="pn-linkbtn" href={ir("inicio")}>← Volver al sitio</a>
      </form>
    </div>
  );
}

// ---------- Armazón: menú + contenido ----------

function Panel({ param, onSalir }: { param: string; onSalir: () => void }) {
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

  const pendientes = avisos?.filter((a) => a.estado === "pendiente").length ?? 0;
  const nuevas = busquedas?.filter((b) => Date.now() - Date.parse(b.creadoEn) < 7 * DIA).length ?? 0;
  const salir = () => void admin.salir().finally(onSalir);
  const aviso = editarId && avisos ? avisos.find((a) => a.id === Number(editarId)) : undefined;

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
    <div className="pn">
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
          !avisos ? <Cargando /> : aviso ? <Editor key={aviso.id} a={aviso} accion={accion} onListo={() => { void recargar(); navegar(ir("admin", "avisos")); }} /> : <p>Ese aviso ya no existe. <a href={ir("admin", "avisos")}>Volver a avisos</a></p>
        ) : seccion === "inicio" ? (
          <Inicio avisos={avisos} busquedas={busquedas} accion={accion} />
        ) : seccion === "avisos" ? (
          avisos ? <Avisos avisos={avisos} accion={accion} /> : <Cargando />
        ) : seccion === "cargar" || seccion === "varios" ? (
          <CargarSeccion varios={seccion === "varios"} onListo={() => { void recargar(); navegar(ir("admin", "avisos")); }} />
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

const Titulo = ({ t, children }: { t: string; children?: ReactNode }) => (
  <div className="pn-titulo"><h1>{t}</h1>{children}</div>
);

function Mas({ items, salir }: { items: [Seccion, string, ReactNode, ReactNode?][]; salir: () => void }) {
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

// ---------- Inicio ----------

function Inicio({ avisos, busquedas, accion }: { avisos: AvisoAdmin[] | null; busquedas: Busqueda[] | null; accion: (fn: () => Promise<unknown>) => Promise<void> }) {
  const est = useCarga<Resumen>(() => admin.estadisticas(7), []);
  const [act, setAct] = useState<DatosActividad | null>(null);
  useEffect(() => {
    const traer = () => { if (document.visibilityState === "visible") admin.actividad("24h").then(setAct, () => {}); };
    traer();
    const t = window.setInterval(traer, 15_000);
    return () => window.clearInterval(t);
  }, []);
  const hoy = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const pend = avisos?.filter((a) => a.estado === "pendiente") ?? [];
  const publicados = avisos?.filter((a) => a.estado === "publicado") ?? [];
  const vencen = publicados.filter((a) => diasHasta(a.venceEn) <= 7).sort((a, b) => Date.parse(a.venceEn) - Date.parse(b.venceEn));
  const nuevas = busquedas?.filter((b) => Date.now() - Date.parse(b.creadoEn) < 7 * DIA) ?? [];
  const e = est.estado === "listo" ? est.datos : null;
  const cambio = (a: number, b: number | undefined) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(Math.round(((a - b) / b) * 100))}% vs. semana anterior` : "Sin comparación todavía");
  const maxDia = Math.max(1, ...(e?.serie.map((s) => s.personas) ?? [1]));
  const sinHacer = pend.length === 0 && nuevas.length === 0 && vencen.length === 0;

  return (
    <>
      <div className="pn-titulo">
        <div><p className="pn-fecha">{hoy}</p><h1>Hola, Felipe</h1></div>
        <a className="pn-btn pn-btn-line pn-solo-compu" href={ir("inicio")} target="_blank" rel="noopener">Ver el sitio <Ico d={I.afuera} size={16} /></a>
        <a className="pn-btn pn-btn-main" href={ir("admin", "cargar")}><Ico d={I.mas} size={18} />Cargar aviso</a>
      </div>

      <div className="pn-fila2">
        <section className="pn-vivo-caja" aria-live="polite">
          <p className="pn-vivo-etq"><i className={act?.enVivo.total ? "on" : ""} />EN VIVO</p>
          <p className="pn-vivo-num"><b>{act ? act.enVivo.total : "–"}</b> {act?.enVivo.total === 1 ? "persona mirando el sitio ahora" : "personas mirando el sitio ahora"}</p>
          {act && act.enVivo.paginas.length > 0 ? (
            <ul>{act.enVivo.paginas.slice(0, 4).map((p) => <li key={p.nombre}><span>{p.nombre.replace(/^Aviso: /, "")}</span><b>{p.n}</b></li>)}</ul>
          ) : <p className="pn-vivo-nadie">Nadie en este momento. Vos con el panel no contás.</p>}
        </section>

        <section className="pn-caja">
          <h2>Para hacer hoy</h2>
          {avisos === null ? <Cargando /> : sinHacer ? <p className="pn-ok">✓ Nada pendiente. Buen momento para salir a conseguir avisos.</p> : (
            <div className="pn-tareas">
              {pend.length > 0 && <a className="pn-tarea fuerte" href={ir("admin", "avisos")}><b>{pend.length}</b><span>{pend.length === 1 ? "aviso espera que lo revises" : "avisos esperan que los revises"}</span><em>Revisar →</em></a>}
              {nuevas.slice(0, 2).map((b) => (
                <a key={b.id} className="pn-tarea" target="_blank" rel="noopener noreferrer" href={linkWA(b.telefono, `Hola ${b.nombre}! Te escribo de Vidriera Chabás por lo que estabas buscando.`)}>
                  <b>1</b><span>búsqueda: <strong>{b.que}</strong> ({b.nombre})</span><em>Escribirle →</em></a>
              ))}
              {vencen.slice(0, 3).map((a) => (
                <button key={a.id} type="button" className="pn-tarea" onClick={() => void accion(() => admin.cambiar(a.id, { renovar: true }))}>
                  <b>!</b><span>{diasHasta(a.venceEn) <= 0 ? "vence hoy" : `vence en ${diasHasta(a.venceEn)} días`}: <strong>{a.titulo}</strong></span><em>Renovar →</em></button>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="pn-nums">
        <Num t="Visitas · 7 días" v={e ? fmtNum(e.total.personas) : "–"} pie={e ? cambio(e.total.personas, e.anterior?.personas) : ""} />
        <Num t="Contactos por WhatsApp" v={e ? fmtNum(e.total.contactos) : "–"} pie={e ? cambio(e.total.contactos, e.anterior?.contactos) : ""} fuerte />
        <Num t="Avisos publicados" v={fmtNum(publicados.length)} pie={`${publicados.filter((a) => a.rubro === "vehiculos").length} vehículos · ${publicados.filter((a) => a.rubro === "inmuebles").length} inmuebles`} />
        <Num t="Disco" v={act ? `${Math.round(act.salud.baseMB + act.salud.fotosMB)} MB` : "–"} pie={act ? `de ${act.salud.limiteMB} MB` : ""} barra={act ? (act.salud.baseMB + act.salud.fotosMB) / act.salud.limiteMB : undefined} />
      </div>

      <div className="pn-fila2">
        <section className="pn-caja">
          <div className="pn-caja-h"><h2>Visitas por día</h2><a href={ir("admin", "estad")}>Ver estadísticas</a></div>
          {e ? (
            <>
              <div className="pn-barras" role="img" aria-label={`Visitas de los últimos 7 días: ${e.serie.map((s) => s.personas).join(", ")}`}>
                {e.serie.map((s) => <div key={s.fecha} title={`${s.fecha.slice(8)}/${s.fecha.slice(5, 7)}: ${s.personas}`}><i style={{ height: `${(s.personas / maxDia) * 100}%` }} /><span>{s.fecha.slice(8).replace(/^0/, "")}</span></div>)}
              </div>
            </>
          ) : <Cargando />}
        </section>
        <section className="pn-caja">
          <div className="pn-caja-h"><h2>Los que más rinden</h2><span>7 días</span></div>
          {!e ? <Cargando /> : e.avisos.length === 0 ? <p className="pn-gris">Todavía sin datos de esta semana.</p> : (
            <ul className="pn-top">
              {e.avisos.slice(0, 4).map((x) => {
                const a = avisos?.find((y) => y.id === x.id);
                const foto = a ? fotoSegura(a.fotos[0] ?? "") : "";
                return (
                  <li key={x.id}>
                    {foto ? <img src={foto} alt="" width={64} height={44} /> : <span className="pn-sinfoto" />}
                    <a href={ir("admin", `editar-${x.id}`)}><b>{x.titulo}</b><span>{a ? `${precioTexto(a)} · ${a.pueblo}` : ""}</span></a>
                    <span className="pn-top-n"><b>{x.contactos}</b> contactos<br />{x.vistas} vistas</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {e && e.sinResultados.length > 0 && (
        <section className="pn-caja">
          <h2>Buscaron y no encontraron <span className="pn-gris">· avisos para salir a conseguir</span></h2>
          <div className="pn-chips">{e.sinResultados.slice(0, 10).map((b) => <span key={b.texto}>{b.texto} · {b.n}</span>)}</div>
        </section>
      )}
    </>
  );
}

function Num({ t, v, pie, fuerte, barra }: { t: string; v: string; pie: string; fuerte?: boolean; barra?: number }) {
  return (
    <div className={`pn-num-caja${fuerte ? " fuerte" : ""}`}>
      <span>{t}</span>
      <b>{v}</b>
      {barra !== undefined && <span className="pn-disco"><i style={{ width: `${Math.min(100, Math.max(2, barra * 100))}%` }} className={barra > 0.8 ? "alto" : ""} /></span>}
      <small>{pie}</small>
    </div>
  );
}

// ---------- Avisos ----------

type Vista = "publicado" | "reservado" | "vendido" | "rechazado";
type Orden = "nuevos" | "contactos" | "vence";

function Avisos({ avisos, accion }: { avisos: AvisoAdmin[]; accion: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [vista, setVista] = useState<Vista>("publicado");
  const [q, setQ] = useState("");
  const [rubro, setRubro] = useState<RubroId | "">("");
  const [orden, setOrden] = useState<Orden>("nuevos");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [menu, setMenu] = useState<number | null>(null);

  const pend = avisos.filter((a) => a.estado === "pendiente");
  const grupos: Record<Vista, AvisoAdmin[]> = {
    publicado: avisos.filter((a) => a.estado === "publicado"),
    reservado: avisos.filter((a) => a.estado === "publicado" && a.reservado),
    vendido: avisos.filter((a) => a.estado === "vendido"),
    rechazado: avisos.filter((a) => a.estado === "rechazado"),
  };
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digitos = soloDigitos(q);
    return grupos[vista]
      .filter((a) => !rubro || a.rubro === rubro)
      .filter((a) => !t || [a.titulo, a.nombre, a.anunciante, a.pueblo].some((x) => x.toLowerCase().includes(t)) || (digitos.length >= 3 && a.telefono.includes(digitos)))
      .sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0) || (orden === "contactos" ? b.contactos - a.contactos : orden === "vence" ? Date.parse(a.venceEn) - Date.parse(b.venceEn) : Date.parse(b.publicadoEn || b.creadoEn) - Date.parse(a.publicadoEn || a.creadoEn)));
  }, [avisos, vista, q, rubro, orden]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setSel(new Set()), [vista]);
  const elegidos = lista.filter((a) => sel.has(a.id));
  const todos = lista.length > 0 && elegidos.length === lista.length;
  const enLote = (fn: (a: AvisoAdmin) => Promise<unknown>) => void accion(async () => { for (const a of elegidos) await fn(a); setSel(new Set()); });

  return (
    <>
      <Titulo t="Avisos">
        <a className="pn-btn pn-btn-line pn-solo-compu" href={ir("admin", "varios")}>Cargar varios (.zip)</a>
        <a className="pn-btn pn-btn-main" href={ir("admin", "cargar")}><Ico d={I.mas} size={18} />Cargar aviso</a>
      </Titulo>

      {pend.length > 0 && (
        <section className="pn-pend" aria-label="Esperan revisión">
          <h2>{pend.length === 1 ? "1 espera que lo revises" : `${pend.length} esperan que los revises`}</h2>
          <div className="pn-pend-grid">
            {pend.map((a) => {
              const foto = fotoSegura(a.fotos[0] ?? "");
              return (
                <div key={a.id} className="pn-pend-item">
                  {foto ? <img src={foto} alt="" width={96} height={72} /> : <span className="pn-sinfoto grande">Sin foto</span>}
                  <div className="pn-pend-txt">
                    <b>{a.titulo}</b>
                    <span>{precioTexto(a)} · {a.pueblo} · {a.fotos.length} {a.fotos.length === 1 ? "foto" : "fotos"}</span>
                    <small>{a.nombre || "Sin nombre"} · {a.telefono || "sin WhatsApp"} · {fmtFecha(new Date(a.creadoEn))}</small>
                  </div>
                  <div className="pn-pend-acc">
                    <button type="button" className="pn-btn pn-btn-ok" onClick={() => void accion(() => admin.cambiar(a.id, { estado: "publicado" }))}>Aprobar</button>
                    <a className="pn-btn pn-btn-line" href={ir("admin", `editar-${a.id}`)}>Revisar</a>
                    <Confirmar texto="Rechazar" chico onSi={() => void accion(() => admin.cambiar(a.id, { estado: "rechazado" }))} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="pn-filtros">
        <div className="pn-seg" role="tablist" aria-label="Estado">
          {([["publicado", "Publicados"], ["reservado", "Reservados"], ["vendido", "Vendidos"], ["rechazado", "Rechazados"]] as const).map(([v, t]) => (
            <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)}>{t} <span>{grupos[v].length}</span></button>
          ))}
        </div>
        <label className="pn-buscar">
          <Ico d={I.buscar} size={18} />
          <span className="sr">Buscar avisos</span>
          <input type="search" placeholder="Buscar por título, vendedor o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="pn-select">Rubro
          <select value={rubro} onChange={(e) => setRubro(e.target.value as RubroId | "")}>
            <option value="">Todos</option>
            {(Object.keys(RUBROS) as RubroId[]).map((r) => <option key={r} value={r}>{RUBROS[r].nombre}</option>)}
          </select>
        </label>
        <label className="pn-select">Orden
          <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
            <option value="nuevos">Más nuevos</option>
            <option value="contactos">Más contactos</option>
            <option value="vence">Vencen antes</option>
          </select>
        </label>
      </div>

      {elegidos.length > 0 && <Lote elegidos={elegidos} vista={vista} enLote={enLote} limpiar={() => setSel(new Set())} />}

      {lista.length === 0 ? (
        <p className="pn-caja pn-gris">{q || rubro ? "Nada coincide con lo que buscaste." : vista === "publicado" ? "Todavía no hay avisos publicados." : "No hay avisos acá."}</p>
      ) : (
        <div className="pn-tabla" role="table" aria-label="Avisos">
          <div className="pn-fila pn-fila-h" role="row">
            <span role="columnheader"><input type="checkbox" aria-label="Elegir todos" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(lista.map((a) => a.id)))} /></span>
            <span role="columnheader">Aviso</span>
            <span role="columnheader">Precio</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader" className="der">Vistas</span>
            <span role="columnheader" className="der">Contactos</span>
            <span role="columnheader">Vence</span>
            <span role="columnheader"><span className="sr">Acciones</span></span>
          </div>
          {lista.map((a) => (
            <FilaAviso key={a.id} a={a} elegido={sel.has(a.id)} onElegir={() => setSel((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })}
              menuAbierto={menu === a.id} onMenu={(abrir) => setMenu(abrir ? a.id : null)} accion={accion} />
          ))}
        </div>
      )}
    </>
  );
}

function Lote({ elegidos, vista, enLote, limpiar }: { elegidos: AvisoAdmin[]; vista: Vista; enLote: (fn: (a: AvisoAdmin) => Promise<unknown>) => void; limpiar: () => void }) {
  const [anunciante, setAnunciante] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  return (
    <div className="pn-lote" role="region" aria-label="Acciones para los elegidos">
      <b>{elegidos.length} {elegidos.length === 1 ? "elegido" : "elegidos"}</b>
      {anunciante !== null ? (
        <form className="pn-lote-form" onSubmit={(e) => { e.preventDefault(); enLote((a) => admin.editar(a.id, { ...aNuevo(a), anunciante: anunciante.trim() })); setAnunciante(null); }}>
          <label><span className="sr">Publicado por</span><input type="text" maxLength={60} placeholder="Publicado por (vacío = nada)" value={anunciante} onChange={(e) => setAnunciante(e.target.value)} autoFocus /></label>
          <button type="submit">Aplicar</button>
          <button type="button" onClick={() => setAnunciante(null)}>Cancelar</button>
        </form>
      ) : borrar ? (
        <>
          <span>¿Borrar {elegidos.length} para siempre?</span>
          <button type="button" className="peligro" onClick={() => { enLote((a) => admin.borrar(a.id)); setBorrar(false); }}>Sí, borrar</button>
          <button type="button" onClick={() => setBorrar(false)}>No</button>
        </>
      ) : (
        <>
          {(vista === "publicado" || vista === "reservado") && <>
            <button type="button" onClick={() => enLote((a) => admin.cambiar(a.id, { renovar: true }))}>Renovar 90 días</button>
            <button type="button" onClick={() => enLote((a) => admin.cambiar(a.id, { estado: "vendido" }))}>Marcar vendidos</button>
          </>}
          {(vista === "vendido" || vista === "rechazado") && <button type="button" onClick={() => enLote((a) => admin.cambiar(a.id, { estado: "publicado" }))}>Volver a publicar</button>}
          <button type="button" onClick={() => setAnunciante("")}>Cambiar «Publicado por»</button>
          <button type="button" className="peligro" onClick={() => setBorrar(true)}>Borrar</button>
          <button type="button" className="pn-lote-x" aria-label="Quitar la selección" onClick={limpiar}>×</button>
        </>
      )}
    </div>
  );
}

const aNuevo = (a: AvisoAdmin): NuevoAviso => ({
  rubro: a.rubro, tipo: a.tipo, operacion: a.operacion, titulo: a.titulo, precio: a.precio === null ? "" : String(a.precio), moneda: a.moneda,
  pueblo: a.pueblo, anunciante: a.anunciante, zona: a.zona, descripcion: a.descripcion, datos: a.datos, permuta: a.permuta, financia: a.financia,
  nombre: a.nombre, telefono: a.telefono, fotos: a.fotos,
} as unknown as NuevoAviso);

function FilaAviso({ a, elegido, onElegir, menuAbierto, onMenu, accion }: {
  a: AvisoAdmin; elegido: boolean; onElegir: () => void; menuAbierto: boolean; onMenu: (abrir: boolean) => void; accion: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const foto = fotoSegura(a.fotos[0] ?? "");
  const dias = diasHasta(a.venceEn);
  const estado = a.estado === "publicado" ? (a.reservado ? ["Reservado", "res"] : ["Publicado", "pub"]) : a.estado === "vendido" ? ["Vendido", "ven"] : a.estado === "rechazado" ? ["Rechazado", "rec"] : ["Pendiente", "pen"];
  const meta = [a.datos.slice(0, 2).join(" · "), a.pueblo, a.anunciante].filter(Boolean).join(" · ");
  return (
    <div className={`pn-fila${elegido ? " elegida" : ""}`} role="row">
      <span role="cell" className="pn-c-sel"><input type="checkbox" aria-label={`Elegir ${a.titulo}`} checked={elegido} onChange={onElegir} /></span>
      <span role="cell" className="pn-c-aviso">
        {foto ? <img src={foto} alt="" width={72} height={52} /> : <span className="pn-sinfoto" />}
        <a href={ir("admin", `editar-${a.id}`)}><b>{a.destacado && <span title="Fijado arriba" className="pn-estrella">★ </span>}{a.titulo}</b><span>{meta}</span></a>
      </span>
      <span role="cell" className="pn-c-precio">{precioTexto(a)}</span>
      <span role="cell" className="pn-c-estado"><span className={`pn-chip ${estado[1]}`}>{estado[0]}</span></span>
      <span role="cell" className="der pn-c-n"><span className="pn-solo-cel">Vistas </span>{a.vistas}</span>
      <span role="cell" className="der pn-c-n"><span className="pn-solo-cel">Contactos </span><b>{a.contactos}</b></span>
      <span role="cell" className={`pn-c-vence${a.estado === "publicado" && dias <= 7 ? " pronto" : ""}`}>{a.estado === "publicado" ? (dias <= 0 ? "Vence hoy" : `en ${dias} días`) : fmtFecha(new Date(a.publicadoEn || a.creadoEn))}</span>
      <span role="cell" className="pn-c-acc">
        <a className="pn-btn pn-btn-line pn-btn-chico" href={ir("admin", `editar-${a.id}`)}>Editar</a>
        <MenuAviso a={a} abierto={menuAbierto} onAbrir={onMenu} accion={accion} />
      </span>
    </div>
  );
}

/** Menú «⋯» de cada aviso. Se cierra tocando afuera o con Esc. */
function MenuAviso({ a, abierto, onAbrir, accion }: { a: AvisoAdmin; abierto: boolean; onAbrir: (abrir: boolean) => void; accion: (fn: () => Promise<unknown>) => Promise<void> }) {
  const caja = useRef<HTMLDivElement>(null);
  const [aviso, setAviso] = useState("");
  const [borrar, setBorrar] = useState(false);
  useEffect(() => {
    if (!abierto) { setBorrar(false); return; }
    const fuera = (e: PointerEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) onAbrir(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onAbrir(false); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto, onAbrir]);
  const hacer = (c: Record<string, unknown>) => { onAbrir(false); void accion(() => admin.cambiar(a.id, c)); };
  const avisar = (t: string) => { setAviso(t); window.setTimeout(() => setAviso(""), 3500); };
  const redes = async () => {
    onAbrir(false);
    avisar("Armando la imagen…");
    try {
      const blob = await tarjetaRedes(a);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vidriera-aviso-${a.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      const ok = await navigator.clipboard?.writeText(textoRedes(a, `${location.origin}/a/${a.id}?de=redes`)).then(() => true, () => false);
      avisar(ok ? "Imagen bajada y texto copiado" : "Imagen bajada");
    } catch (e) { avisar(mensajeError(e)); }
  };
  const copiarLink = async () => {
    onAbrir(false);
    const ok = await navigator.clipboard?.writeText(`${location.origin}/a/${a.id}?de=wa`).then(() => true, () => false);
    avisar(ok ? "Link copiado" : "No se pudo copiar");
  };
  const pub = a.estado === "publicado";
  return (
    <div className="pn-menu-av" ref={caja}>
      <button type="button" className="pn-puntos" aria-label={`Más acciones de ${a.titulo}`} aria-expanded={abierto} aria-haspopup="menu" onClick={() => onAbrir(!abierto)}><Ico d={I.puntos} size={20} /></button>
      {aviso && <span className="pn-toast" role="status">{aviso}</span>}
      {abierto && (
        <div className="pn-pop" role="menu">
          {pub && <a role="menuitem" href={ir("aviso", a.id)} target="_blank" rel="noopener">Ver en el sitio</a>}
          {pub && <button role="menuitem" type="button" onClick={() => hacer({ destacado: !a.destacado })}>{a.destacado ? "★ Sacar de arriba" : "★ Fijar arriba"}</button>}
          {pub && <button role="menuitem" type="button" onClick={() => hacer({ reservado: !a.reservado })}>{a.reservado ? "Sacar «Reservado»" : "Marcar reservado"}</button>}
          {pub && <button role="menuitem" type="button" onClick={() => hacer({ estado: "vendido" })}>Marcar vendido</button>}
          {pub && <button role="menuitem" type="button" onClick={() => hacer({ renovar: true })}>Renovar 90 días</button>}
          {!pub && a.estado !== "pendiente" && <button role="menuitem" type="button" onClick={() => hacer({ estado: "publicado" })}>Volver a publicar</button>}
          {pub && <button role="menuitem" type="button" onClick={() => void redes()}>Tarjeta para redes</button>}
          {pub && <button role="menuitem" type="button" onClick={() => void copiarLink()}>Copiar link del aviso</button>}
          {a.fotos.length > 0 && <a role="menuitem" href={`api/admin/avisos/${a.id}/fotos.zip`} download={`aviso-${a.id}-fotos.zip`} onClick={() => onAbrir(false)}>Bajar fotos ({a.fotos.length})</a>}
          {a.telefono && <a role="menuitem" target="_blank" rel="noopener noreferrer" href={linkWA(a.telefono, `Hola ${a.nombre}! Te escribo de Vidriera Chabás por tu aviso «${a.titulo}».`)}>Escribirle al vendedor</a>}
          <hr />
          {borrar ? (
            <div className="pn-pop-confirma">¿Borrar para siempre?
              <button type="button" className="peligro" onClick={() => { onAbrir(false); void accion(() => admin.borrar(a.id)); }}>Sí, borrar</button>
              <button type="button" onClick={() => setBorrar(false)}>No</button>
            </div>
          ) : <button role="menuitem" type="button" className="peligro" onClick={() => setBorrar(true)}>Borrar…</button>}
        </div>
      )}
    </div>
  );
}

/** Borrar/Rechazar pide una segunda confirmación en la misma pantalla. */
function Confirmar({ texto, onSi, chico }: { texto: string; onSi: () => void; chico?: boolean }) {
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

// ---------- Editar / cargar ----------

const valoresDe = (a: AvisoAdmin): ValoresForm => ({
  rubro: a.rubro, tipo: a.tipo, operacion: a.operacion, titulo: a.titulo, precio: a.precio === null ? "" : String(a.precio), moneda: a.moneda,
  permuta: a.permuta, financia: a.financia, descripcion: a.descripcion, nombre: a.nombre, telefono: a.telefono, fotos: a.fotos, zona: a.zona, datos: a.datos.join(", "), anunciante: a.anunciante,
  pueblo: PUEBLOS.includes(a.pueblo) ? a.pueblo : OTRO_PUEBLO, puebloOtro: PUEBLOS.includes(a.pueblo) ? "" : a.pueblo,
});

/** Lo que el formulario tiene ahora, como lo vería alguien en el sitio. */
function vistaPrevia(v: ValoresForm, id = 0): AvisoPublico {
  const pueblo = v.pueblo === OTRO_PUEBLO ? v.puebloOtro.trim() || "Otro" : v.pueblo || "Pueblo";
  const precio = Number(soloDigitos(v.precio)) || null;
  return {
    id, rubro: (v.rubro || "inmuebles") as RubroId, tipo: v.tipo || "Tipo", operacion: v.operacion || "venta", titulo: v.titulo || "Título del aviso",
    precio, precioAnterior: null, moneda: v.moneda, pueblo, zona: v.zona, descripcion: v.descripcion,
    datos: v.datos.split(",").map((x) => x.trim()).filter(Boolean), permuta: v.permuta, financia: v.financia, fotos: v.fotos,
    anunciante: v.anunciante, ejemplo: false, reservado: false, destacado: false, publicadoEn: new Date().toISOString(), venceEn: new Date().toISOString(),
  } as AvisoPublico;
}

function Revision({ v }: { v: ValoresForm }) {
  const datos = v.datos.split(",").map((x) => x.trim()).filter(Boolean);
  const tel = soloDigitos(v.telefono);
  const items: [boolean, string][] = [
    [v.fotos.length >= 3, v.fotos.length === 0 ? "Sin fotos: los avisos con fotos reciben muchas más consultas" : v.fotos.length < 3 ? `Solo ${v.fotos.length} ${v.fotos.length === 1 ? "foto" : "fotos"}: mejor 3 o más` : `${v.fotos.length} fotos`],
    [!!soloDigitos(v.precio), soloDigitos(v.precio) ? "Tiene precio" : "Sin precio: va a decir «Consultar»"],
    [!!v.pueblo, v.pueblo ? "Dice dónde está" : "Falta el pueblo"],
    [tel.length >= 8, tel.length >= 8 ? "WhatsApp cargado" : "Falta el WhatsApp de contacto"],
    [datos.length >= 2, datos.length >= 2 ? "Datos destacados" : "Sumá datos destacados (año, km, dormitorios…)"],
  ];
  if (/\b(19|20)\d{2}\b|\d+\.?\d*\s?km\b/i.test(v.titulo)) items.push([false, "El título tiene año o km: pasalos a datos destacados"]);
  if (v.descripcion.trim().length < 20) items.push([false, "Descripción corta o vacía"]);
  return (
    <ul className="pn-revision">
      {items.map(([ok, t]) => <li key={t} className={ok ? "ok" : "ojo"}><span aria-hidden="true">{ok ? "✓" : "!"}</span>{t}</li>)}
    </ul>
  );
}

function Editor({ a, accion, onListo }: { a: AvisoAdmin; accion: (fn: () => Promise<unknown>) => Promise<void>; onListo: () => void }) {
  const [v, setV] = useState<ValoresForm>(() => valoresDe(a));
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<ErrorCampo[]>([]);
  const [error, setError] = useState("");
  const aprobar = useRef(false);
  useTitulo(`Editar · ${a.titulo}`);
  const guardar = (n: NuevoAviso) => {
    setEnviando(true);
    setErrores([]);
    setError("");
    admin.editar(a.id, n).then(
      async () => { if (aprobar.current) await accion(() => admin.cambiar(a.id, { estado: "publicado" })); onListo(); },
      (e: unknown) => { if (e instanceof ErrorApi) { setErrores(e.campos); setError(e.campos.length ? "Revisá los datos marcados." : e.message); } else setError(mensajeError(e)); },
    ).finally(() => { setEnviando(false); aprobar.current = false; });
  };
  return (
    <>
      <div className="pn-titulo pn-titulo-edit">
        <a className="pn-volver" href={ir("admin", "avisos")}>← Avisos</a>
        <h1>{a.titulo}</h1>
        <span className={`pn-chip ${a.estado === "publicado" ? "pub" : a.estado === "pendiente" ? "pen" : "ven"}`}>{a.estado === "publicado" ? "Publicado" : a.estado === "pendiente" ? "Pendiente" : a.estado === "vendido" ? "Vendido" : "Rechazado"}</span>
      </div>
      <div className="pn-edit">
        <div className="pn-edit-form pn-caja">
          <FormAviso
            valores={v}
            onCambio={setV}
            exigirFotos={false}
            avanzado
            enviando={enviando}
            erroresServidor={errores}
            textoBoton={a.estado === "pendiente" ? "Guardar sin publicar" : "Guardar cambios"}
            pie={<>
              {error && <p className="form-err" role="alert">{error}</p>}
              {a.estado === "pendiente" && <button type="submit" className="pn-btn pn-btn-ok pn-btn-xl" disabled={enviando} onClick={() => { aprobar.current = true; }}>Guardar y publicar</button>}
              <a className="pn-btn pn-btn-line" href={ir("admin", "avisos")}>Cancelar</a>
            </>}
            onEnviar={guardar}
          />
        </div>
        <aside className="pn-edit-lado">
          <section className="pn-caja">
            <h2 className="pn-h-chico">Así se ve en el sitio</h2>
            <div className="grid pn-previa"><Tarjeta aviso={vistaPrevia(v, a.id)} previa /></div>
          </section>
          <section className="pn-caja">
            <h2 className="pn-h-chico">Antes de publicar</h2>
            <Revision v={v} />
          </section>
          <section className="pn-caja pn-gris pn-edit-datos">
            <span>{a.vistas} vistas · {a.contactos} contactos</span>
            <span>Cargado {fmtFecha(new Date(a.creadoEn))}{a.estado === "publicado" ? ` · vence ${fmtFecha(new Date(a.venceEn))}` : ""}</span>
          </section>
        </aside>
      </div>
    </>
  );
}

function CargarSeccion({ varios, onListo }: { varios: boolean; onListo: () => void }) {
  return (
    <>
      <Titulo t="Cargar avisos" />
      <div className="pn-seg pn-seg-cargar" role="tablist" aria-label="Cómo cargar">
        <a role="tab" aria-selected={!varios} href={ir("admin", "cargar")}>De a uno</a>
        <a role="tab" aria-selected={varios} href={ir("admin", "varios")}>Varios juntos (.zip)</a>
      </div>
      {varios ? <div className="pn-caja"><CargarVarios onListo={onListo} /></div> : <CargarUno onListo={onListo} />}
    </>
  );
}

function CargarUno({ onListo }: { onListo: () => void }) {
  const [v, setV] = useState<ValoresForm>(() => valoresIniciales(""));
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<ErrorCampo[]>([]);
  const [error, setError] = useState("");
  return (
    <div className="pn-edit">
      <div className="pn-edit-form pn-caja">
        <FormAviso
          valores={v}
          onCambio={setV}
          exigirFotos={false}
          avanzado
          enviando={enviando}
          erroresServidor={errores}
          textoBoton="Publicar aviso"
          pie={error ? <p className="form-err" role="alert">{error}</p> : null}
          onEnviar={(a) => {
            setEnviando(true);
            setErrores([]);
            setError("");
            admin.crear(a).then(
              () => { setV(valoresIniciales("")); onListo(); },
              (e: unknown) => { if (e instanceof ErrorApi) { setErrores(e.campos); setError(e.campos.length ? "Revisá los datos marcados." : e.message); } else setError(mensajeError(e)); },
            ).finally(() => setEnviando(false));
          }}
        />
      </div>
      <aside className="pn-edit-lado">
        <section className="pn-caja">
          <h2 className="pn-h-chico">Así se va a ver</h2>
          <div className="grid pn-previa"><Tarjeta aviso={vistaPrevia(v)} previa /></div>
        </section>
        <section className="pn-caja">
          <h2 className="pn-h-chico">Antes de publicar</h2>
          <Revision v={v} />
        </section>
      </aside>
    </div>
  );
}

// ---------- Búsquedas ----------

function Busquedas({ busquedas, accion }: { busquedas: Busqueda[] | null; accion: (fn: () => Promise<unknown>) => Promise<void> }) {
  return (
    <>
      <Titulo t="Búsquedas" />
      <p className="pn-gris">Gente que dejó su WhatsApp en «Avisame cuando aparezca». Cuando consigas algo, escribiles.</p>
      {busquedas === null ? <Cargando /> : busquedas.length === 0 ? <p className="pn-caja pn-gris">Todavía nadie dejó una búsqueda.</p> : (
        <div className="pn-busq">
          {busquedas.map((b) => {
            const nueva = Date.now() - Date.parse(b.creadoEn) < 7 * DIA;
            return (
              <div key={b.id} className="pn-caja pn-busq-item">
                <div className="pn-busq-txt">
                  <span className="pn-busq-rubro">{b.rubro}{nueva && <span className="pn-chip pen">Nueva</span>}</span>
                  <b>{b.que}</b>
                  <span className="pn-gris">{b.nombre} · {b.presupuesto || "sin presupuesto"} · {fmtFecha(new Date(b.creadoEn))}</span>
                </div>
                <div className="pn-busq-acc">
                  <a className="pn-btn pn-btn-wa" target="_blank" rel="noopener noreferrer" href={linkWA(b.telefono, `Hola ${b.nombre}! Te escribo de Vidriera Chabás por lo que estabas buscando.`)}>WhatsApp</a>
                  <Confirmar texto="Borrar" onSi={() => void accion(() => admin.borrarBusqueda(b.id))} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
