import { useCallback, useEffect, useState, type FormEvent } from "react";
import { fmtFecha, soloDigitos } from "../../../shared/texto.ts";
import type { AvisoAdmin, Busqueda, ErrorCampo, Estado } from "../../../shared/tipos.ts";
import { linkWA } from "../../../shared/whatsapp.ts";
import { ErrorApi, admin, conServidor } from "../api.ts";
import { FormAviso, valoresIniciales, type ValoresForm } from "../components/FormAviso.tsx";
import { Cargando } from "../components/Tarjeta.tsx";
import { fotoSegura, precioTexto } from "../formato.ts";
import { useCarga, useTitulo } from "../hooks.ts";
import { ir } from "../router.ts";

type Pestana = Estado | "busquedas" | "cargar";
const PESTANAS: [Pestana, string][] = [
  ["pendiente", "Pendientes"], ["publicado", "Publicados"], ["vendido", "Vendidos"], ["rechazado", "Rechazados"], ["busquedas", "Búsquedas"], ["cargar", "Cargar aviso"],
];
const mensajeError = (e: unknown) => (e instanceof Error ? e.message : "Algo salió mal.");

export function Admin() {
  useTitulo("Panel");
  const servidor = useCarga(() => conServidor(), []);
  const [sesion, setSesion] = useState<"?" | "si" | "no">("?");
  useEffect(() => {
    if (servidor.estado !== "listo" || !servidor.datos) return;
    admin.sesion().then((r) => setSesion(r.ok ? "si" : "no"), () => setSesion("no"));
  }, [servidor]);

  if (servidor.estado === "cargando" || (servidor.estado === "listo" && servidor.datos && sesion === "?")) return <div className="wrap"><Cargando /></div>;
  if (servidor.estado !== "listo" || !servidor.datos)
    return <div className="wrap prose"><h1>Panel</h1><p>El panel funciona cuando el sitio está corriendo en su servidor. En esta vista previa no hay base de datos.</p></div>;
  if (sesion === "no") return <Login onEntrar={() => setSesion("si")} />;
  return <Panel onSalir={() => setSesion("no")} />;
}

function Login({ onEntrar }: { onEntrar: () => void }) {
  const [clave, setClave] = useState("");
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
    <div className="wrap">
      <form className="form login" onSubmit={(e) => void entrar(e)}>
        <h1>Panel de Vidriera</h1>
        <div>
          <label className="lbl" htmlFor="clave">Contraseña</label>
          <input id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
        </div>
        {error && <p className="form-err" role="alert">{error}</p>}
        <button className="btn btn-main btn-xl" type="submit" disabled={enviando || !clave}>{enviando ? "Entrando…" : "Entrar"}</button>
      </form>
    </div>
  );
}

function Panel({ onSalir }: { onSalir: () => void }) {
  const [pestana, setPestana] = useState<Pestana>("pendiente");
  const [avisos, setAvisos] = useState<AvisoAdmin[] | null>(null);
  const [busquedas, setBusquedas] = useState<Busqueda[] | null>(null);
  const [error, setError] = useState("");
  const [pendientes, setPendientes] = useState(0);

  const cargar = useCallback(async () => {
    setError("");
    try {
      const pend = await admin.avisos("pendiente");
      setPendientes(pend.length);
      if (pestana === "busquedas") setBusquedas(await admin.busquedas());
      else if (pestana !== "cargar") setAvisos(pestana === "pendiente" ? pend : await admin.avisos(pestana));
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) onSalir();
      else setError(mensajeError(e));
    }
  }, [pestana, onSalir]);
  useEffect(() => {
    setAvisos(null);
    setBusquedas(null);
    void cargar();
  }, [cargar]);

  const accion = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await cargar();
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) onSalir();
      else setError(mensajeError(e));
    }
  };

  return (
    <div className="wrap panel">
      <div className="panel-h">
        <h1>Panel</h1>
        <button type="button" className="btn btn-line" onClick={() => void admin.salir().finally(onSalir)}>Salir</button>
      </div>
      <nav className="subnav tabs" aria-label="Secciones del panel">
        {PESTANAS.map(([k, t]) => (
          <a key={k} href={ir("admin")} aria-current={pestana === k ? "page" : undefined} onClick={(e) => { e.preventDefault(); setPestana(k); }}>
            {t}{k === "pendiente" && pendientes > 0 ? ` (${pendientes})` : ""}
          </a>
        ))}
      </nav>
      {error && <p className="form-err" role="alert">{error}</p>}
      {pestana === "cargar" ? (
        <Cargar onListo={() => setPestana("publicado")} />
      ) : pestana === "busquedas" ? (
        busquedas === null ? <Cargando /> : busquedas.length === 0 ? <p>No hay búsquedas guardadas.</p> : (
          <ul className="admin-lista">
            {busquedas.map((b) => (
              <li key={b.id} className="admin-item">
                <div>
                  <b>{b.rubro}</b> — {b.que}
                  <p className="small">{b.nombre} · {b.presupuesto || "sin presupuesto"} · {fmtFecha(new Date(b.creadoEn))}</p>
                </div>
                <div className="admin-acc">
                  <a className="btn btn-wa" target="_blank" rel="noopener noreferrer" href={linkWA(b.telefono, `Hola ${b.nombre}! Te escribo de Vidriera Chabás por lo que estabas buscando.`)}>WhatsApp</a>
                  <Confirmar texto="Borrar" onSi={() => void accion(() => admin.borrarBusqueda(b.id))} />
                </div>
              </li>
            ))}
          </ul>
        )
      ) : avisos === null ? <Cargando /> : avisos.length === 0 ? <p>No hay avisos acá.</p> : (
        <ul className="admin-lista">
          {avisos.map((a) => <ItemAviso key={a.id} a={a} accion={accion} />)}
        </ul>
      )}
    </div>
  );
}

function ItemAviso({ a, accion }: { a: AvisoAdmin; accion: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [precio, setPrecio] = useState(a.precio === null ? "" : String(a.precio));
  const foto = fotoSegura(a.fotos[0] ?? "");
  const cambiar = (c: Record<string, unknown>) => void accion(() => admin.cambiar(a.id, c));
  return (
    <li className="admin-item">
      {foto ? <img className="admin-foto" src={foto} alt="" width={120} height={80} /> : <div className="admin-foto sin-foto">Sin foto</div>}
      <div className="admin-datos">
        <b>{a.titulo}</b> {a.ejemplo && <span className="badge">Ejemplo</span>}
        <p className="small">{a.tipo} · {a.operacion} · {precioTexto(a)} · {a.fotos.length} foto(s)</p>
        <p className="small">{a.nombre || "Sin nombre"} · {a.telefono || "sin WhatsApp"} · {a.estado === "publicado" ? `publicado ${fmtFecha(new Date(a.publicadoEn))}, vence ${fmtFecha(new Date(a.venceEn))}` : `cargado ${fmtFecha(new Date(a.creadoEn))}`}</p>
        <p className="small">{a.vistas} visitas · {a.contactos} contactos por WhatsApp</p>
        {a.descripcion && <details><summary>Descripción</summary><p className="small">{a.descripcion}</p></details>}
      </div>
      <div className="admin-acc">
        {a.estado === "pendiente" && <>
          <button type="button" className="btn btn-main" onClick={() => cambiar({ estado: "publicado" })}>Aprobar</button>
          <button type="button" className="btn btn-line" onClick={() => cambiar({ estado: "rechazado" })}>Rechazar</button>
        </>}
        {a.estado === "publicado" && <>
          <a className="btn btn-line" href={ir("aviso", a.id)}>Ver</a>
          <button type="button" className="btn btn-line" onClick={() => cambiar({ estado: "vendido" })}>Vendido</button>
          <button type="button" className="btn btn-line" onClick={() => cambiar({ renovar: true })}>Renovar 90 días</button>
        </>}
        {(a.estado === "vendido" || a.estado === "rechazado") && <button type="button" className="btn btn-line" onClick={() => cambiar({ estado: "publicado" })}>Volver a publicar</button>}
        <form className="precio-edit" onSubmit={(e) => { e.preventDefault(); cambiar({ precio: soloDigitos(precio), moneda: a.moneda }); }}>
          <label className="sr" htmlFor={`p-${a.id}`}>Precio</label>
          <input id={`p-${a.id}`} type="text" inputMode="numeric" value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D+/g, ""))} />
          <button type="submit" className="btn btn-line">Cambiar precio</button>
        </form>
        {a.telefono && <a className="btn btn-wa" target="_blank" rel="noopener noreferrer" href={linkWA(a.telefono, `Hola ${a.nombre}! Te escribo de Vidriera Chabás por tu aviso «${a.titulo}».`)}>WhatsApp</a>}
        <Confirmar texto="Borrar" onSi={() => void accion(() => admin.borrar(a.id))} />
      </div>
    </li>
  );
}

/** Borrar pide una segunda confirmación en la misma pantalla (sin ventanitas del navegador). */
function Confirmar({ texto, onSi }: { texto: string; onSi: () => void }) {
  const [preguntando, setPreguntando] = useState(false);
  return preguntando ? (
    <span className="confirmar">
      ¿Seguro? <button type="button" className="btn btn-peligro" onClick={onSi}>Sí, {texto.toLowerCase()}</button>
      <button type="button" className="linkbtn" onClick={() => setPreguntando(false)}>No</button>
    </span>
  ) : (
    <button type="button" className="btn btn-line" onClick={() => setPreguntando(true)}>{texto}</button>
  );
}

function Cargar({ onListo }: { onListo: () => void }) {
  const [v, setV] = useState<ValoresForm>(() => valoresIniciales(""));
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<ErrorCampo[]>([]);
  const [error, setError] = useState("");
  return (
    <FormAviso
      valores={v}
      onCambio={setV}
      exigirFotos={false}
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
          (e: unknown) => { if (e instanceof ErrorApi) { setErrores(e.campos); setError(e.campos.length ? "" : e.message); } else setError(mensajeError(e)); },
        ).finally(() => setEnviando(false));
      }}
    />
  );
}
