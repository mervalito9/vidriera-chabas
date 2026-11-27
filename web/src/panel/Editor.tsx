// Editar un aviso y cargar avisos nuevos (de a uno o varios con el .zip), con vista previa en vivo.
import { textoPublica, type Cliente } from "../components/form/Cliente.tsx";
import { CONDICIONES_VACIAS, limpiarCondiciones } from "../../../shared/alquiler.ts";
import { useRef, useState, useEffect } from "react";
import { OTRO_PUEBLO, PUEBLOS } from "../../../shared/config.ts";
import { fmtFecha, soloDigitos } from "../../../shared/texto.ts";
import type { AvisoAdmin, AvisoPublico, ErrorCampo, NuevoAviso, RubroId } from "../../../shared/tipos.ts";
import { ErrorApi, admin } from "../api.ts";
import { FormAviso, valoresIniciales, type ValoresForm } from "../components/form/FormAviso.tsx";
import { Tarjeta } from "../components/Tarjeta.tsx";
import { ir } from "../router.ts";
import { CargarVarios } from "./CargarVarios.tsx";
import { PanelMejora, conPropuesta, useMejora } from "./Mejora.tsx";
import { Titulo, mensajeError, type Accion } from "./comunes.tsx";

export const valoresDe = (a: AvisoAdmin): ValoresForm => ({
  rubro: a.rubro, tipo: a.tipo, operacion: a.operacion, titulo: a.titulo, precio: a.precio === null ? "" : String(a.precio), moneda: a.moneda,
  permuta: a.permuta, financia: a.financia, descripcion: a.descripcion, nombre: a.nombre, telefono: a.telefono, fotos: a.fotos, zona: a.zona, datos: a.datos.join(", "), anunciante: a.anunciante, quien: a.quien || (a.anunciante ? "inmobiliaria" : "dueno"),
  condiciones: a.condiciones ?? CONDICIONES_VACIAS, lat: a.lat, lng: a.lng, foco: a.foco,
  pueblo: PUEBLOS.includes(a.pueblo) ? a.pueblo : OTRO_PUEBLO, puebloOtro: PUEBLOS.includes(a.pueblo) ? "" : a.pueblo,
});

/** Lo que el formulario tiene ahora, como lo vería alguien en el sitio. */
export function vistaPrevia(v: ValoresForm, id = 0): AvisoPublico {
  const pueblo = v.pueblo === OTRO_PUEBLO ? v.puebloOtro.trim() || "Otro" : v.pueblo || "Pueblo";
  const precio = Number(soloDigitos(v.precio)) || null;
  return {
    id, rubro: (v.rubro || "inmuebles") as RubroId, tipo: v.tipo || "Tipo", operacion: v.operacion || "venta", titulo: v.titulo || "Título del aviso",
    precio, precioAnterior: null, moneda: v.moneda, pueblo, zona: v.zona, descripcion: v.descripcion,
    datos: v.datos.split(",").map((x) => x.trim()).filter(Boolean), permuta: v.permuta, financia: v.financia, fotos: v.fotos,
    anunciante: v.anunciante, quien: v.quien, publica: textoPublica(v), condiciones: v.operacion === "alquiler" ? limpiarCondiciones(v.condiciones) : null, lat: v.lat, lng: v.lng, foco: v.foco, ejemplo: false, reservado: false, destacado: false, publicadoEn: new Date().toISOString(), venceEn: new Date().toISOString(),
  } as AvisoPublico;
}

export function Revision({ v }: { v: ValoresForm }) {
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

export function Editor({ a, accion, onListo, clientes }: { a: AvisoAdmin; accion: Accion; onListo: () => void; clientes: Cliente[] }) {
  // Si el asistente ya ordenó el aviso (y Felipe no lo descartó), el formulario arranca con la versión ordenada.
  const propuestaInicial = a.estado === "pendiente" && a.mejora?.estado === "lista" ? a.mejora.propuesta : null;
  const [v, setV] = useState<ValoresForm>(() => (propuestaInicial ? conPropuesta(valoresDe(a), a, propuestaInicial) : valoresDe(a)));
  const [usando, setUsando] = useState(!!propuestaInicial);
  const m = useMejora(a);
  const usar = () => { if (m.mejora?.propuesta) { setV(conPropuesta(valoresDe(a), a, m.mejora.propuesta)); setUsando(true); } };
  const original = () => { setV(valoresDe(a)); setUsando(false); };
  // Si la propuesta llega con el aviso abierto y Felipe no cambió nada todavía, se carga sola.
  // Se recuerda qué propuesta ya se mostró (por su fecha), así elegir «Original» no se pisa con la próxima actualización.
  const vista = useRef(propuestaInicial ? (a.mejora?.fecha ?? "") : "");
  const sinTocar = JSON.stringify(v) === JSON.stringify(valoresDe(a));
  const fechaNueva = m.mejora?.estado === "lista" && m.mejora.propuesta ? m.mejora.fecha : "";
  useEffect(() => {
    if (!fechaNueva || fechaNueva === vista.current) return;
    vista.current = fechaNueva;
    if (m.mejora?.propuesta && sinTocar && a.estado === "pendiente") { setV(conPropuesta(valoresDe(a), a, m.mejora.propuesta)); setUsando(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaNueva]);
  const sumar = (frase: string) => setV((x) => ({ ...x, descripcion: `${x.descripcion.trim()}${x.descripcion.trim() ? "\n" : ""}${frase}` }));
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<ErrorCampo[]>([]);
  const [error, setError] = useState("");
  const aprobar = useRef(false);
  const guardar = (n: NuevoAviso) => {
    setEnviando(true);
    setErrores([]);
    setError("");
    admin.editar(a.id, n).then(
      async () => {
        if (m.mejora?.estado === "lista") void admin.marcarMejora(a.id, usando ? "usada" : "descartada").catch(() => {});
        if (aprobar.current) await accion(() => admin.cambiar(a.id, { estado: "publicado" }));
        onListo();
      },
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
      <PanelMejora a={a} activo={m.activo} mejora={m.mejora} usando={usando} onUsar={usar} onOriginal={original} onSumar={sumar} rehacer={m.rehacer} error={m.error} />
      <div className="pn-edit">
        <div className="pn-edit-form pn-caja">
          <FormAviso
            valores={v}
            onCambio={setV}
            exigirFotos={false}
            avanzado
            clientes={clientes}
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

export function CargarSeccion({ varios, onListo, clientes }: { varios: boolean; onListo: () => void; clientes: Cliente[] }) {
  return (
    <>
      <Titulo t="Cargar avisos" />
      <div className="pn-seg pn-seg-cargar" role="tablist" aria-label="Cómo cargar">
        <a role="tab" aria-selected={!varios} href={ir("admin", "cargar")}>De a uno</a>
        <a role="tab" aria-selected={varios} href={ir("admin", "varios")}>Varios juntos (.zip)</a>
      </div>
      {varios ? <div className="pn-caja"><CargarVarios onListo={onListo} /></div> : <CargarUno onListo={onListo} clientes={clientes} />}
    </>
  );
}

export function CargarUno({ onListo, clientes }: { onListo: () => void; clientes: Cliente[] }) {
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
          clientes={clientes}
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
