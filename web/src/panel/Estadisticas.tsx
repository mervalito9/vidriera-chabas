import { useState } from "react";
import type { ResumenEstadisticas as Resumen } from "../../../shared/tipos.ts";
import { admin } from "../api.ts";
import { Cargando } from "../components/Tarjeta.tsx";
import { useCarga } from "../hooks.ts";
import { ir } from "../router.ts";
import { fmtNum } from "../../../shared/texto.ts";

const PERIODOS = [7, 30, 90] as const;
const ESTADOS: Record<string, string> = { publicado: "Publicados", pendiente: "Pendientes", vendido: "Vendidos", rechazado: "Rechazados" };
export const diaCorto = (f: string) => { const [, m, d] = f.split("-"); return `${Number(d)}/${Number(m)}`; };

/** Tablero del panel: cuánta gente entra, cuántos contactos hay, qué avisos rinden y qué busca la gente. */
export function Estadisticas({ pendientes, irPendientes }: { pendientes: number; irPendientes: () => void }) {
  const [dias, setDias] = useState<number>(30);
  const r = useCarga(() => admin.estadisticas(dias), [dias]);
  if (r.estado === "error") return <p className="form-err" role="alert">{r.mensaje}</p>;
  if (r.estado !== "listo") return <Cargando />;
  const d = r.datos;
  const sinDatos = d.total.personas === 0 && d.total.contactos === 0;

  return (
    <div className="estad">
      <div className="estad-cab">
        <div className="pestanas-home" role="tablist" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={dias === p} className={dias === p ? "activa" : ""} onClick={() => setDias(p)}>Últimos {p} días</button>
          ))}
        </div>
        {d.desde && <p className="small">Se mide desde el {diaCorto(d.desde)}. Las visitas de antes no se cuentan.</p>}
      </div>

      {pendientes > 0 && (
        <p className="estad-alerta"><b>{pendientes} {pendientes === 1 ? "aviso espera" : "avisos esperan"} tu revisión.</b> <button type="button" className="btn btn-line" onClick={irPendientes}>Ver pendientes</button></p>
      )}

      <div className="estad-num">
        <Numero titulo="Visitas" ayuda="Personas por día (la misma persona en dos días cuenta dos veces)" valor={d.total.personas} antes={d.anterior?.personas} />
        <Numero titulo="Avisos vistos" ayuda="Una vez por persona, aviso y día" valor={d.total.vistas} antes={d.anterior?.vistas} />
        <Numero titulo="Contactos por WhatsApp" ayuda="Toques en «Hablar por WhatsApp». Una vez por persona, aviso y día" valor={d.total.contactos} antes={d.anterior?.contactos} fuerte />
        <div className="estad-tile">
          <span className="estad-t">Avisos</span>
          <b className="estad-v">{fmtNum(d.avisosEstado.publicado ?? 0)}</b>
          <span className="small">publicados · {d.avisosEstado.pendiente ?? 0} pend. · {d.avisosEstado.vendido ?? 0} vendidos</span>
        </div>
      </div>

      {d.portada.entran > 0 && (
        <section className="estad-bloque estad-portada">
          <h3>¿Pasan de la portada?</h3>
          <p>
            De <b>{fmtNum(d.portada.entran)}</b> {d.portada.entran === 1 ? "persona que entró" : "personas que entraron"} por la portada,{" "}
            <b>{fmtNum(d.portada.siguen)}</b> ({Math.round((d.portada.siguen / d.portada.entran) * 100)}%) abrieron después un aviso u otra pantalla.
          </p>
          <p className="small">El resto miró la portada y se fue. Se mide desde el 25/11. Es más confiable que «En vivo», que muestra solo dónde está cada uno en este momento.</p>
        </section>
      )}

      {d.novedades && d.novedades.ven + d.novedades.abren > 0 && (
        <section className="estad-bloque estad-portada">
          <h3>🔔 Campanita de novedades</h3>
          <p>
            <b>{fmtNum(d.novedades.ven)}</b> {d.novedades.ven === 1 ? "persona la vio" : "personas la vieron"} con novedades y <b>{fmtNum(d.novedades.abren)}</b> la{" "}
            {d.novedades.abren === 1 ? "abrió" : "abrieron"}
            {d.novedades.ven > 0 ? ` (${Math.round((d.novedades.abren / d.novedades.ven) * 100)}%)` : ""}.
          </p>
          {d.novedades.toques.length > 0 && (
            <p className="small">
              Adentro tocaron:{" "}
              {d.novedades.toques
                .map((t) => `${({ pill: "el mensaje de la pastilla", nuevos: "avisos nuevos", bajo: "bajó de precio", busquedas: "se buscan", publicar: "publicar", wa: "WhatsApp" } as Record<string, string>)[t.que] ?? t.que} (${t.n})`)
                .join(" · ")}
            </p>
          )}
        </section>
      )}

      {sinDatos ? (
        <p className="estad-vacio">Todavía no hay visitas medidas en este período. Se empiezan a contar desde ahora: volvé en unos días.</p>
      ) : (
        <>
          <div className="estad-graf">
            <Barras titulo="Visitas por día" serie={d.serie.map((s) => ({ x: s.fecha, y: s.personas }))} color="var(--terra)" />
            <Barras titulo="Contactos por WhatsApp por día" serie={d.serie.map((s) => ({ x: s.fecha, y: s.contactos }))} color="var(--oliva)" />
          </div>

          <section className="estad-bloque">
            <h3>Avisos que más rinden</h3>
            {d.avisos.length === 0 ? <p className="small">Todavía nadie entró a un aviso en este período.</p> : (
              <table className="estad-tabla">
                <thead><tr><th>Aviso</th><th>Vistas</th><th>Contactos</th><th title="Contactos cada 100 vistas. Solo con 20 vistas o más">Cada 100</th></tr></thead>
                <tbody>
                  {d.avisos.map((a) => (
                    <tr key={a.id}>
                      <td><a href={ir("admin", `editar-${a.id}`)}>{a.titulo}</a>{a.estado !== "publicado" && <span className="small"> · {ESTADOS[a.estado]?.toLowerCase() ?? a.estado}</span>}</td>
                      <td>{a.vistas}</td>
                      <td><b>{a.contactos}</b></td>
                      <td>{a.vistas >= 20 ? Math.round((a.contactos / a.vistas) * 100) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="small">Si un aviso tiene muchas vistas y casi ningún contacto, revisá el precio o las fotos.</p>
          </section>

          <div className="estad-dos">
            <Lista titulo="De dónde llega la gente" filas={d.origenes.map((o) => [o.nombre, o.n])} nota="«Directo» incluye a quien escribe la dirección y muchos links de WhatsApp. Los links de «Compartir» y de la «Tarjeta para redes» ya vienen marcados." />
            <Lista titulo="Qué no encontraron" filas={d.sinResultados.map((b) => [b.texto, b.n])} nota="Búsquedas sin ningún resultado: avisos para salir a conseguir." vacio="Nadie se quedó sin resultados." />
            <Lista titulo="Qué busca la gente" filas={d.busquedas.map((b) => [b.texto, b.n])} vacio="Todavía nadie usó el buscador." />
            <Cruce titulo="Por rubro" filas={d.rubros.map((x) => ({ ...x, nombre: x.nombre === "inmuebles" ? "Inmuebles" : x.nombre === "vehiculos" ? "Vehículos" : x.nombre === "agro" ? "Maquinaria agro" : x.nombre }))} />
            <Cruce titulo="Por pueblo" filas={d.pueblos} />
          </div>
        </>
      )}
      <p className="small estad-pie">Sin cookies ni Google Analytics: no se guarda quién es cada persona. No se cuentan robots ni tus visitas mientras estés en el panel. Son números aproximados: mirá más la tendencia que el número exacto.</p>
    </div>
  );
}

function Numero({ titulo, ayuda, valor, antes, fuerte }: { titulo: string; ayuda: string; valor: number; antes?: number; fuerte?: boolean }) {
  let cambio: string | null = null;
  if (antes !== undefined && antes > 0) {
    const p = Math.round(((valor - antes) / antes) * 100);
    cambio = `${p > 0 ? "▲ +" : p < 0 ? "▼ " : ""}${p}% vs. período anterior`;
  }
  return (
    <div className={`estad-tile${fuerte ? " fuerte" : ""}`} title={ayuda}>
      <span className="estad-t">{titulo}</span>
      <b className="estad-v">{fmtNum(valor)}</b>
      <span className="small">{cambio ?? ayuda}</span>
    </div>
  );
}

/** Barras por día, una sola serie (sin doble eje). Al pasar el mouse o tocar, muestra el día y el valor. */
export function Barras({ titulo, serie, color, etiqueta = diaCorto, formato = (n: number) => fmtNum(n) }: { titulo: string; serie: { x: string; y: number }[]; color: string; etiqueta?: (x: string) => string; formato?: (n: number) => string }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...serie.map((s) => s.y));
  const W = 600, H = 160, n = serie.length, paso = W / n, ancho = Math.max(2, paso - 2);
  const total = serie.reduce((s, x) => s + x.y, 0);
  const marcas = [0, Math.floor((n - 1) / 2), n - 1];
  const v = sel !== null ? serie[sel] : null;
  return (
    <figure className="estad-barras">
      <figcaption><b>{titulo}</b> <span className="small">{v ? `${etiqueta(v.x)}: ${formato(v.y)}` : `Total: ${formato(total)} · máximo: ${formato(max)}`}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}: total ${total}`} onPointerLeave={() => setSel(null)}>
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--crema-2)" strokeWidth="1" />
        {serie.map((s, i) => {
          const h = s.y === 0 ? 0 : Math.max(3, (s.y / max) * (H - 16));
          return (
            <g key={s.x} onPointerEnter={() => setSel(i)} onClick={() => setSel(i)}>
              <rect x={i * paso} y={0} width={paso} height={H} fill="transparent" />
              {h > 0 && <rect x={i * paso + 1} y={H - h} width={ancho} height={h} rx={Math.min(4, ancho / 2)} fill={color} opacity={sel === null || sel === i ? 1 : 0.45} />}
            </g>
          );
        })}
      </svg>
      {/* Las fechas van como texto común (dentro del dibujo quedaban diminutas en el celular). */}
      <div className="estad-ejes" aria-hidden="true">{marcas.map((i) => serie[i] && <span key={i}>{etiqueta(serie[i]!.x)}</span>)}</div>
      <details className="small"><summary>Ver como tabla</summary>
        <table className="estad-tabla"><tbody>{serie.filter((s) => s.y > 0).reverse().map((s) => <tr key={s.x}><td>{etiqueta(s.x)}</td><td>{formato(s.y)}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}

function Lista({ titulo, filas, nota, vacio }: { titulo: string; filas: [string, number][]; nota?: string; vacio?: string }) {
  const max = Math.max(1, ...filas.map((f) => f[1]));
  return (
    <section className="estad-bloque">
      <h3>{titulo}</h3>
      {filas.length === 0 ? <p className="small">{vacio ?? "Sin datos todavía."}</p> : (
        <ul className="estad-lista">
          {filas.map(([k, n]) => (
            <li key={k}><span className="estad-lista-k">{k}</span><span className="estad-lista-b"><i style={{ width: `${(n / max) * 100}%` }} /></span><b>{n}</b></li>
          ))}
        </ul>
      )}
      {nota && <p className="small">{nota}</p>}
    </section>
  );
}

function Cruce({ titulo, filas }: { titulo: string; filas: Resumen["rubros"] }) {
  return (
    <section className="estad-bloque">
      <h3>{titulo}</h3>
      {filas.length === 0 ? <p className="small">Sin datos todavía.</p> : (
        <table className="estad-tabla">
          <thead><tr><th></th><th>Vistas</th><th>Contactos</th></tr></thead>
          <tbody>{filas.map((f) => <tr key={f.nombre}><td>{f.nombre}</td><td>{f.vistas}</td><td><b>{f.contactos}</b></td></tr>)}</tbody>
        </table>
      )}
    </section>
  );
}
