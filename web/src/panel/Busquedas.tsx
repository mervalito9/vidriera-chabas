// Búsquedas guardadas ("Avisame cuando aparezca") y las que se muestran en el sitio ("Se buscan").
import { useState, type FormEvent } from "react";
import { DIAS_SE_BUSCAN, RUBROS } from "../../../shared/config.ts";
import { fmtFecha } from "../../../shared/texto.ts";
import type { Busqueda, RubroId } from "../../../shared/tipos.ts";
import { linkWA } from "../../../shared/whatsapp.ts";
import { admin } from "../api.ts";
import { Cargando } from "../components/Tarjeta.tsx";
import { Confirmar, Titulo, diasHasta, esNueva, mensajeError, type Accion } from "./comunes.tsx";

/** Cuántos días le quedan a una búsqueda que se muestra en el sitio (0 o menos = ya venció y no se ve). */
const diasQueQuedan = (b: Busqueda): number | null => (b.publicaDesde ? diasHasta(new Date(Date.parse(b.publicaDesde) + DIAS_SE_BUSCAN * 864e5).toISOString()) : null);

function Agregar({ accion }: { accion: Accion }) {
  const [rubro, setRubro] = useState<RubroId>("inmuebles");
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [directo, setDirecto] = useState(false);
  const [error, setError] = useState("");

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (titulo.trim().length < 3) return setError("Escribí qué se busca, en pocas palabras.");
    setError("");
    try {
      await accion(() => admin.crearBusquedaPublica({ rubro, titulo, detalle, directo }));
      setTitulo("");
      setDetalle("");
      setDirecto(false);
    } catch (err) {
      setError(mensajeError(err));
    }
  };

  return (
    <form className="pn-caja pn-busq-nueva" onSubmit={(e) => void enviar(e)}>
      <b>Agregar una búsqueda para mostrar en el sitio</b>
      <p className="pn-gris">Para las que te llegaron por otro lado. Se muestra sin nombre ni teléfono, {DIAS_SE_BUSCAN} días.</p>
      <label>Rubro
        <select value={rubro} onChange={(e) => setRubro(e.target.value as RubroId)}>
          {Object.values(RUBROS).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </label>
      <label>Qué se busca
        <input value={titulo} maxLength={60} placeholder="Alquiler de casa o dpto" onChange={(e) => setTitulo(e.target.value)} />
      </label>
      <label>Detalle (opcional)
        <input value={detalle} maxLength={80} placeholder="1 o 2 habitaciones" onChange={(e) => setDetalle(e.target.value)} />
      </label>
      <label className="pn-check"><input type="checkbox" checked={directo} onChange={(e) => setDirecto(e.target.checked)} /> Quiere trato con el dueño directo</label>
      {error && <p className="pn-error" role="alert">{error}</p>}
      <button className="pn-btn pn-btn-p" type="submit">Agregar y mostrar</button>
    </form>
  );
}

export function Busquedas({ busquedas, accion }: { busquedas: Busqueda[] | null; accion: Accion }) {
  return (
    <>
      <Titulo t="Búsquedas" />
      <p className="pn-gris">Gente que busca algo. Con «Mostrar en el sitio» aparece en «Se buscan», sin nombre ni teléfono, y los dueños te escriben a vos.</p>
      <Agregar accion={accion} />
      {busquedas === null ? <Cargando /> : busquedas.length === 0 ? <p className="pn-caja pn-gris">Todavía nadie dejó una búsqueda.</p> : (
        <div className="pn-busq">
          {busquedas.map((b) => {
            const nueva = esNueva(b.creadoEn);
            const quedan = diasQueQuedan(b);
            const visible = quedan !== null && quedan > 0;
            return (
              <div key={b.id} className="pn-caja pn-busq-item">
                <div className="pn-busq-txt">
                  <span className="pn-busq-rubro">
                    {RUBROS[b.rubro as RubroId]?.nombre ?? b.rubro}
                    {nueva && <span className="pn-chip pen">Nueva</span>}
                    {visible && <span className="pn-chip">En el sitio · {quedan} {quedan === 1 ? "día" : "días"}</span>}
                    {quedan !== null && !visible && <span className="pn-chip pen">Venció</span>}
                  </span>
                  <b>{b.titulo || b.que}</b>
                  {b.detalle && <span>{b.detalle}{b.directo ? " · Dueño directo" : ""}</span>}
                  <span className="pn-gris">{b.telefono ? `${b.nombre} · ` : ""}{b.presupuesto || "sin presupuesto"} · {fmtFecha(new Date(b.creadoEn))}</span>
                </div>
                <div className="pn-busq-acc">
                  {b.telefono && <a className="pn-btn pn-btn-wa" target="_blank" rel="noopener noreferrer" href={linkWA(b.telefono, `Hola ${b.nombre}! Te escribo de Vidriera Chabás por lo que estabas buscando.`)}>WhatsApp</a>}
                  {b.permiso || visible ? (
                    <button type="button" className="pn-btn" onClick={() => void accion(() => admin.cambiarBusqueda(b.id, { publica: !visible }))}>
                      {visible ? "Ocultar" : quedan !== null ? "Mostrar de nuevo" : "Mostrar en el sitio"}
                    </button>
                  ) : <span className="pn-gris">No aceptó que se muestre</span>}
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
