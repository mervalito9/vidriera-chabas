// Avisos del panel: pendientes arriba, lista con filtros, selección en grupo y menú «⋯» de cada aviso.
import { useEffect, useMemo, useRef, useState } from "react";
import { RUBROS } from "../../../shared/config.ts";
import { fmtFecha, soloDigitos } from "../../../shared/texto.ts";
import type { AvisoAdmin, NuevoAviso, RubroId } from "../../../shared/tipos.ts";
import { formatearTelefono, linkWA } from "../../../shared/whatsapp.ts";
import { admin } from "../api.ts";
import { fotoSegura, precioTexto } from "../formato.ts";
import { ir } from "../router.ts";
import { Confirmar, I, Ico, Titulo, diasHasta, type Accion } from "./comunes.tsx";
import { RedesDialogo } from "./Redes.tsx";

export type Vista = "publicado" | "reservado" | "vendido" | "rechazado";
export type Orden = "nuevos" | "contactos" | "vence";

export function Avisos({ avisos, accion }: { avisos: AvisoAdmin[]; accion: Accion }) {
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
                    <small>{a.nombre || "Sin nombre"} · {a.telefono ? formatearTelefono(a.telefono) : "sin WhatsApp"} · {fmtFecha(new Date(a.creadoEn))}</small>
                    {a.mejora?.estado === "lista" && a.mejora.propuesta && (
                      <span className="pn-chip pn-chip-mejora">✨ Ordenado{a.mejora.propuesta.faltan.length ? ` · falta ${a.mejora.propuesta.faltan.map((f) => f.que.toLowerCase()).join(", ")}` : ""}</span>
                    )}
                    {a.mejora?.estado === "trabajando" && <span className="pn-chip">✨ Ordenando…</span>}
                    {a.mejora?.estado !== "lista" && a.telefono && a.mejora?.propuesta?.mensajeDueno && a.mejora.propuesta.faltan.length > 0 && (
                      <a className="pn-chip pn-chip-mejora" target="_blank" rel="noopener noreferrer" href={linkWA(a.telefono, a.mejora.propuesta.mensajeDueno)}>✨ Pedirle por WhatsApp: {a.mejora.propuesta.faltan.map((f) => f.que.toLowerCase()).join(", ")}</a>
                    )}
                  </div>
                  <div className="pn-pend-acc">
                    {a.mejora?.estado === "lista" ? (
                      <>
                        <a className="pn-btn pn-btn-ok" href={ir("admin", `editar-${a.id}`)}>Ver ordenado</a>
                        <button type="button" className="pn-btn pn-btn-line" onClick={() => void accion(() => admin.cambiar(a.id, { estado: "publicado" }))}>Aprobar el original</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="pn-btn pn-btn-ok" onClick={() => void accion(() => admin.cambiar(a.id, { estado: "publicado" }))}>Aprobar</button>
                        <a className="pn-btn pn-btn-line" href={ir("admin", `editar-${a.id}`)}>Revisar</a>
                      </>
                    )}
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

      {elegidos.length > 0 && <BarraSeleccion elegidos={elegidos} vista={vista} enLote={enLote} limpiar={() => setSel(new Set())} />}

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

function BarraSeleccion({ elegidos, vista, enLote, limpiar }: { elegidos: AvisoAdmin[]; vista: Vista; enLote: (fn: (a: AvisoAdmin) => Promise<unknown>) => void; limpiar: () => void }) {
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

/** Un aviso del panel, como lo pide el servidor para guardarlo (para cambios en grupo). */
const aNuevo = (a: AvisoAdmin): NuevoAviso => ({
  rubro: a.rubro, tipo: a.tipo, operacion: a.operacion, titulo: a.titulo, precio: a.precio, moneda: a.moneda,
  pueblo: a.pueblo, anunciante: a.anunciante, quien: a.quien, zona: a.zona, descripcion: a.descripcion, datos: a.datos,
  permuta: a.permuta, financia: a.financia, nombre: a.nombre, telefono: a.telefono, fotos: a.fotos, condiciones: a.condiciones, lat: a.lat, lng: a.lng,
});

export function FilaAviso({ a, elegido, onElegir, menuAbierto, onMenu, accion }: {
  a: AvisoAdmin; elegido: boolean; onElegir: () => void; menuAbierto: boolean; onMenu: (abrir: boolean) => void; accion: Accion;
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
export function MenuAviso({ a, abierto, onAbrir, accion }: { a: AvisoAdmin; abierto: boolean; onAbrir: (abrir: boolean) => void; accion: Accion }) {
  const caja = useRef<HTMLDivElement>(null);
  const [aviso, setAviso] = useState("");
  const [borrar, setBorrar] = useState(false);
  const [redes, setRedes] = useState(false);
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
      {redes && <RedesDialogo a={a} onCerrar={() => setRedes(false)} />}
      {abierto && (
        <div className="pn-pop" role="menu" aria-label={`Acciones de ${a.titulo}`}>
          <p className="pn-pop-titulo">{a.titulo}</p>
          {pub && <a role="menuitem" href={ir("aviso", a.id)} target="_blank" rel="noopener">Ver en el sitio</a>}
          {pub && <button role="menuitem" type="button" onClick={() => hacer({ destacado: !a.destacado })}>{a.destacado ? "★ Sacar de arriba" : "★ Fijar arriba"}</button>}
          {pub && <button role="menuitem" type="button" onClick={() => hacer({ reservado: !a.reservado })}>{a.reservado ? "Sacar «Reservado»" : "Marcar reservado"}</button>}
          {pub && <button role="menuitem" type="button" onClick={() => hacer({ estado: "vendido" })}>Marcar vendido</button>}
          {pub && <button role="menuitem" type="button" onClick={() => hacer({ renovar: true })}>Renovar 90 días</button>}
          {!pub && a.estado !== "pendiente" && <button role="menuitem" type="button" onClick={() => hacer({ estado: "publicado" })}>Volver a publicar</button>}
          <button role="menuitem" type="button" onClick={() => { onAbrir(false); setRedes(true); }}>Para redes (historia y posteo)</button>
          {pub && <button role="menuitem" type="button" onClick={() => void copiarLink()}>Copiar link del aviso</button>}
          {a.fotos.length > 0 && <a role="menuitem" href={`api/admin/avisos/${a.id}/fotos.zip`} download={`aviso-${a.id}-fotos.zip`} onClick={() => onAbrir(false)}>Bajar fotos ({a.fotos.length})</a>}
          {a.telefono && a.mejora?.propuesta?.mensajeDueno && (a.mejora.propuesta.faltan.length > 0 || a.mejora.propuesta.notasFotos) && (
            <a role="menuitem" target="_blank" rel="noopener noreferrer" href={linkWA(a.telefono, a.mejora.propuesta.mensajeDueno)}>✨ Pedirle lo que falta ({a.mejora.propuesta.faltan.map((f) => f.que.toLowerCase()).join(", ") || "fotos"})</a>
          )}
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
