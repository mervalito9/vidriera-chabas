// Panel: lo que propuso el asistente para un aviso que mandó un vecino. Felipe ve qué cambió,
// elige entre la versión ordenada y la original, y le pide al dueño lo que falta por WhatsApp.
import { useEffect, useState } from "react";
import { OTRO_PUEBLO, PUEBLOS } from "../../../shared/config.ts";
import type { AvisoAdmin, Mejora, PropuestaMejora } from "../../../shared/tipos.ts";
import { linkWA, numeroWA } from "../../../shared/whatsapp.ts";
import { admin } from "../api.ts";
import type { ValoresForm } from "../components/form/FormAviso.tsx";
import { mensajeError } from "./comunes.tsx";

/** Los valores del formulario con la propuesta aplicada (contacto, condiciones y ubicación quedan como estaban). */
export function conPropuesta(base: ValoresForm, a: AvisoAdmin, p: PropuestaMejora): ValoresForm {
  const fotos = p.ordenFotos.map((i) => a.fotos[i]).filter((f): f is string => !!f);
  return {
    ...base,
    tipo: p.tipo,
    operacion: p.operacion,
    titulo: p.titulo,
    precio: p.precio === null ? base.precio : String(p.precio),
    moneda: p.moneda,
    pueblo: PUEBLOS.includes(p.pueblo) ? p.pueblo : p.pueblo ? OTRO_PUEBLO : base.pueblo,
    puebloOtro: PUEBLOS.includes(p.pueblo) ? "" : p.pueblo || base.puebloOtro,
    zona: p.zona || base.zona,
    descripcion: p.descripcion || base.descripcion,
    datos: p.datos.length ? p.datos.join(", ") : base.datos,
    permuta: p.permuta,
    financia: p.financia,
    fotos: fotos.length === a.fotos.length ? fotos : a.fotos,
  };
}

/** Pregunta cada pocos segundos mientras el asistente trabaja. */
export function useMejora(a: AvisoAdmin): { activo: boolean | null; mejora: Mejora | null; rehacer: () => void; error: string } {
  const [activo, setActivo] = useState<boolean | null>(null);
  const [mejora, setMejora] = useState<Mejora | null>(a.mejora);
  const [error, setError] = useState("");
  const trabajando = mejora?.estado === "trabajando";
  useEffect(() => {
    if (a.estado !== "pendiente" && !a.mejora) return;
    let vivo = true;
    const leer = () => admin.mejora(a.id).then((r) => { if (vivo) { setActivo(r.activo); setMejora(r.mejora); } }, () => {});
    void leer();
    const t = trabajando ? window.setInterval(() => void leer(), 4000) : 0;
    return () => { vivo = false; if (t) window.clearInterval(t); };
  }, [a.id, a.estado, a.mejora, trabajando]);
  const rehacer = () => {
    setError("");
    admin.mejorar(a.id).then(() => setMejora({ estado: "trabajando", propuesta: null, error: "", fecha: new Date().toISOString() }), (e: unknown) => setError(mensajeError(e)));
  };
  return { activo, mejora, rehacer, error };
}

export function PanelMejora({ a, activo, mejora, usando, onUsar, onOriginal, onSumar, rehacer, error }: {
  a: AvisoAdmin;
  activo: boolean | null;
  mejora: Mejora | null;
  usando: boolean;
  onUsar: () => void;
  onOriginal: () => void;
  onSumar: (frase: string) => void;
  rehacer: () => void;
  error: string;
}) {
  const p = mejora?.propuesta ?? null;
  if (!mejora && a.estado !== "pendiente") return null;
  if (!mejora) {
    if (activo === false)
      return <section className="pn-caja pn-mejora pn-gris">El asistente que ordena los avisos está apagado: falta cargar la clave <b>OPENROUTER_API_KEY</b> en Railway.</section>;
    if (activo) return <section className="pn-caja pn-mejora"><p>Este aviso todavía no lo ordenó el asistente.</p><button type="button" className="pn-btn" onClick={rehacer}>Ordenarlo ahora</button>{error && <p className="form-err">{error}</p>}</section>;
    return null;
  }
  if (mejora.estado === "trabajando")
    return <section className="pn-caja pn-mejora"><p className="pn-mejora-trabajando">✨ El asistente está ordenando este aviso… (tarda menos de un minuto)</p></section>;
  if (mejora.estado === "error" || !p)
    return (
      <section className="pn-caja pn-mejora">
        <p>El asistente no pudo ordenar este aviso{mejora.error ? ` (${mejora.error})` : ""}.</p>
        <button type="button" className="pn-btn" onClick={rehacer}>Probar de nuevo</button>
        {error && <p className="form-err">{error}</p>}
      </section>
    );

  const tapaNueva = p.ordenFotos[0] !== undefined && p.ordenFotos[0] !== 0;
  const wa = numeroWA(a.telefono) && p.mensajeDueno ? linkWA(a.telefono, p.mensajeDueno) : "";
  return (
    <section className="pn-caja pn-mejora">
      <div className="pn-mejora-cab">
        <h2 className="pn-h-chico">✨ El asistente ordenó este aviso</h2>
        <div className="pn-seg" role="tablist" aria-label="Qué versión ver">
          <button type="button" role="tab" aria-selected={usando} onClick={onUsar}>Ordenado</button>
          <button type="button" role="tab" aria-selected={!usando} onClick={onOriginal}>Original</button>
        </div>
      </div>
      <p className="pn-gris small">{usando ? "El formulario de abajo ya tiene la versión ordenada. Revisala, cambiá lo que quieras y tocá «Guardar y publicar»." : "Estás viendo lo que mandó el vecino, sin tocar."}</p>

      <div className="pn-antes-ahora">
        <div><span>Antes</span><b>{a.titulo}</b></div>
        <div><span>Ahora</span><b>{p.titulo}</b></div>
      </div>
      {p.cambios.length > 0 && <ul className="pn-mejora-lista">{p.cambios.map((c) => <li key={c}>{c}</li>)}{tapaNueva && !p.cambios.some((c) => /foto/i.test(c)) && <li>Otra foto de tapa</li>}</ul>}
      {p.notasFotos && <p className="pn-mejora-fotos"><b>Fotos:</b> {p.notasFotos}</p>}

      {p.faltan.length > 0 && (
        <div className="pn-mejora-faltan">
          <b>Le falta:</b>
          <ul>{p.faltan.map((f) => <li key={f.que}><b>{f.que}</b> — {f.pregunta}</li>)}</ul>
          {wa && <a className="pn-btn pn-btn-wa" target="_blank" rel="noopener noreferrer" href={wa}>Pedírselo por WhatsApp</a>}
          {wa && <details className="pn-mejora-msj"><summary>Ver el mensaje</summary><p>{p.mensajeDueno}</p></details>}
        </div>
      )}

      {p.sugerencias.length > 0 && (
        <div className="pn-mejora-sug">
          <b>Datos que podrías sumar</b> <span className="pn-gris small">(no los dijo el dueño: confirmalos antes)</span>
          <ul>{p.sugerencias.map((s) => <li key={s}><span>{s}</span><button type="button" className="pn-btn pn-btn-line pn-btn-chico" onClick={() => onSumar(s)}>Sumar</button></li>)}</ul>
        </div>
      )}
      <button type="button" className="linkbtn small" onClick={rehacer}>Volver a ordenarlo</button>
      {error && <p className="form-err">{error}</p>}
    </section>
  );
}
