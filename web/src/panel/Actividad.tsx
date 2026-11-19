import { useEffect, useState } from "react";
import type { CuentaActividad as Cuenta, ResumenActividad as Datos } from "../../../shared/tipos.ts";
import { admin } from "../api.ts";
import { Cargando } from "../components/Tarjeta.tsx";
import { fmtNum } from "../../../shared/texto.ts";
import { Barras, diaCorto } from "./Estadisticas.tsx";

const PERIODOS = [["24h", "Últimas 24 horas"], ["7d", "7 días"], ["30d", "30 días"]] as const;
type Periodo = (typeof PERIODOS)[number][0];

const mb = (bytes: number) => (bytes >= 1048576 * 100 ? `${fmtNum(Math.round(bytes / 1048576))} MB` : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB` : `${fmtNum(Math.round(bytes / 1024))} KB`);
const etiquetaHora = (x: string) => (x.includes("T") ? `${Number(x.slice(11, 13))} h` : diaCorto(x));
const hace = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  if (min < 48 * 60) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} días`;
};
const horaCorta = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

/** Actividad del servidor: en vivo, todos los pedidos (con recargas y robots), errores, velocidad y disco. */
export function Actividad() {
  const [periodo, setPeriodo] = useState<Periodo>("24h");
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [actualizado, setActualizado] = useState<Date | null>(null);

  useEffect(() => {
    let vivo = true;
    const traer = () => {
      if (document.visibilityState !== "visible") return;
      admin.actividad(periodo).then(
        (x) => { if (vivo) { setD(x); setError(""); setActualizado(new Date()); } },
        (e: unknown) => { if (vivo) setError(e instanceof Error ? e.message : "No se pudo cargar."); },
      );
    };
    traer();
    const t = window.setInterval(traer, 10_000); // se actualiza solo mientras lo mirás
    return () => { vivo = false; window.clearInterval(t); };
  }, [periodo]);

  if (error && !d) return <p className="form-err" role="alert">{error}</p>;
  if (!d) return <Cargando />;
  const t = d.total;
  const personasDePaso = t.pedidos - t.robots;
  const usadoMB = d.salud.baseMB + d.salud.fotosMB;
  const pctDisco = Math.min(100, Math.round((usadoMB / d.salud.limiteMB) * 100));
  const serie = (f: (c: Cuenta) => number) => d.serie.map((s) => ({ x: s.x, y: f(s.c) }));
  const errores4 = d.errores.filter((e) => e.estado < 500);
  const errores5 = d.errores.filter((e) => e.estado >= 500);

  return (
    <div className="estad">
      <div className="estad-cab">
        <div className="pestanas-home" role="tablist" aria-label="Período">
          {PERIODOS.map(([id, nombre]) => (
            <button key={id} type="button" role="tab" aria-selected={periodo === id} className={periodo === id ? "activa" : ""} onClick={() => setPeriodo(id)}>{nombre}</button>
          ))}
        </div>
        <p className="small">Se actualiza solo cada 10 segundos{actualizado ? ` · última vez ${actualizado.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}{error ? ` · ${error}` : ""}</p>
      </div>

      <section className="vivo">
        <div className="vivo-num">
          <span className={`vivo-punto${d.enVivo.total > 0 ? " on" : ""}`} aria-hidden="true" />
          <div><b className="estad-v">{d.enVivo.total}</b> <span>{d.enVivo.total === 1 ? "persona en el sitio ahora" : "personas en el sitio ahora"}</span></div>
        </div>
        {d.enVivo.paginas.length > 0 ? (
          <ul className="vivo-lista">{d.enVivo.paginas.map((p) => <li key={p.nombre}><span>{p.nombre}</span><b>{p.n}</b></li>)}</ul>
        ) : <p className="small">Nadie con el sitio abierto en el último minuto. (Vos con el panel abierto no contás.)</p>}
      </section>

      <div className="estad-num">
        <Tile titulo="Pedidos al servidor" valor={fmtNum(t.pedidos)} pie={`${fmtNum(t.robots)} de robots`} />
        <Tile titulo="Páginas cargadas" valor={fmtNum(t.paginas)} pie="Cada entrada o recarga" />
        <Tile titulo="Datos enviados" valor={mb(t.bytes)} pie={`${fmtNum(t.fotos)} fotos servidas`} />
        <Tile titulo="Errores" valor={fmtNum(t.e4 + t.e5)} pie={`${t.e5} del servidor · ${t.e4} del visitante`} alerta={t.e5 > 0} />
        <Tile titulo="Velocidad" valor={t.pedidos ? `${Math.round(t.ms / t.pedidos)} ms` : "—"} pie={t.lentos ? `${t.lentos} pedidos de más de 1 s` : "Promedio por pedido"} />
        <Tile titulo="Contraseñas mal en el panel" valor={fmtNum(t.loginMal)} pie={t.loginMal >= 10 ? "Muchos intentos: ¿alguien probando?" : "Intentos fallidos de entrar"} alerta={t.loginMal >= 10} />
      </div>

      <div className="estad-graf">
        <Barras titulo={periodo === "24h" ? "Pedidos por hora" : "Pedidos por día"} serie={serie((c) => c.pedidos)} color="var(--tinta-2)" etiqueta={etiquetaHora} />
        <Barras titulo={periodo === "24h" ? "Páginas cargadas por hora" : "Páginas cargadas por día"} serie={serie((c) => c.paginas)} color="var(--terra)" etiqueta={etiquetaHora} />
        <Barras titulo="Datos enviados" serie={serie((c) => c.bytes)} color="var(--oliva)" etiqueta={etiquetaHora} formato={mb} />
        <Barras titulo="Errores" serie={serie((c) => c.e4 + c.e5)} color="#A1341A" etiqueta={etiquetaHora} />
      </div>

      <section className="estad-bloque">
        <h3>En qué se van los pedidos</h3>
        <table className="estad-tabla">
          <tbody>
            <tr><td>Páginas (entrar o recargar el sitio, links de avisos)</td><td>{fmtNum(t.paginas)}</td></tr>
            <tr><td>Fotos</td><td>{fmtNum(t.fotos)}</td></tr>
            <tr><td>Datos (listados, avisos, contactos, panel)</td><td>{fmtNum(t.api)}</td></tr>
            <tr><td>Archivos del sitio (estilos, íconos, código)</td><td>{fmtNum(t.archivos)}</td></tr>
            <tr><td><b>Total</b> · de personas: {fmtNum(personasDePaso)} · de robots: {fmtNum(t.robots)}</td><td><b>{fmtNum(t.pedidos)}</b></td></tr>
          </tbody>
        </table>
      </section>

      <div className="estad-dos">
        <section className="estad-bloque">
          <h3>Últimos errores del servidor</h3>
          {errores5.length === 0 ? <p className="small ok">✓ Ninguno. Todo en orden.</p> : <ListaErrores errores={errores5} />}
          <p className="small">Son los graves: algo falló de nuestro lado. Si se repiten, avisame con una captura.</p>
        </section>
        <section className="estad-bloque">
          <h3>Últimos errores del visitante</h3>
          {errores4.length === 0 ? <p className="small">Ninguno.</p> : <ListaErrores errores={errores4.slice(0, 25)} />}
          <p className="small">Normales en cualquier sitio: avisos que ya no están, direcciones mal escritas, robots probando, demasiados intentos.</p>
        </section>
      </div>

      <section className="estad-bloque">
        <h3>Salud del servidor</h3>
        <div className="disco">
          <div className="disco-barra" role="meter" aria-valuemin={0} aria-valuemax={d.salud.limiteMB} aria-valuenow={usadoMB} aria-label="Disco usado">
            <i style={{ width: `${pctDisco}%` }} className={pctDisco >= 80 ? "alto" : ""} />
          </div>
          <p className="small"><b>Disco: {usadoMB.toFixed(1).replace(".", ",")} MB de {d.salud.limiteMB} MB ({pctDisco}%)</b> · fotos {d.salud.fotosMB.toFixed(1).replace(".", ",")} MB ({fmtNum(d.salud.cantFotos)} archivos) · base {d.salud.baseMB.toFixed(1).replace(".", ",")} MB</p>
          {pctDisco >= 80 && <p className="err">El disco está casi lleno: hay que agrandarlo en Railway antes de que no se puedan subir más fotos.</p>}
        </div>
        <p className="small">Encendido desde {horaCorta(d.salud.arranque)} ({hace(d.salud.arranque)}; se reinicia con cada cambio que subimos) · memoria en uso {fmtNum(Math.round(d.salud.memoriaMB))} MB</p>
      </section>

      <p className="small estad-pie">Cuenta todo lo que llega al servidor, con recargas y robots. Para saber cuántas personas reales hay, mirá Estadísticas. No se guardan IPs. Los datos de la última hora pueden tardar hasta un minuto en aparecer.</p>
    </div>
  );
}

function Tile({ titulo, valor, pie, alerta }: { titulo: string; valor: string; pie: string; alerta?: boolean }) {
  return (
    <div className={`estad-tile${alerta ? " alerta" : ""}`}>
      <span className="estad-t">{titulo}</span>
      <b className="estad-v">{valor}</b>
      <span className="small">{pie}</span>
    </div>
  );
}

function ListaErrores({ errores }: { errores: Datos["errores"] }) {
  return (
    <ul className="errores">
      {errores.map((e, i) => (
        <li key={i}>
          <span className={`err-cod${e.estado >= 500 ? " grave" : ""}`}>{e.estado}</span>
          <span className="err-txt"><b>{e.metodo} {e.ruta}</b>{e.mensaje && <> · {e.mensaje}</>}{e.robot && <> · robot</>}<br /><span className="small">{horaCorta(e.fecha)}</span></span>
        </li>
      ))}
    </ul>
  );
}
