import { useState } from "react";
import { RUBROS } from "../../../shared/config.ts";
import { fmtFecha, fmtNum } from "../../../shared/texto.ts";
import type { AvisoPublico } from "../../../shared/tipos.ts";
import { ErrorApi, linkContacto, listarAvisos, obtenerAviso } from "../api.ts";
import { Cargando, Tarjeta } from "../components/Tarjeta.tsx";
import { fotoSegura, porMes, precioTexto } from "../formato.ts";
import { useCarga, useTitulo } from "../hooks.ts";
import { ir } from "../router.ts";

/** La única página de aviso: se llena con los datos que devuelve el backend para ese id. */
export function Aviso({ id }: { id: number }) {
  const carga = useCarga(() => obtenerAviso(id), [id]);
  const aviso = carga.estado === "listo" ? carga.datos : null;
  useTitulo(aviso ? aviso.titulo : carga.estado === "cargando" ? "Aviso" : "Aviso no encontrado");

  if (carga.estado === "cargando") return <div className="wrap"><Cargando /></div>;
  if (carga.estado === "error") return <div className="wrap prose"><p className="form-err" role="alert">{carga.mensaje}</p></div>;
  if (!aviso)
    return (
      <div className="wrap prose">
        <h1>Este aviso ya no está.</h1>
        <p>Puede que se haya vendido, que lo hayan bajado o que haya vencido (los avisos duran 90 días).</p>
        <p><a className="btn btn-main" href={ir("buscar")}>Ver todos los avisos</a></p>
      </div>
    );
  return <FichaAviso a={aviso} />;
}

function FichaAviso({ a }: { a: AvisoPublico }) {
  const R = RUBROS[a.rubro];
  const fotos = a.fotos.map(fotoSegura).filter(Boolean);
  const [foto, setFoto] = useState(0);
  const otros = useCarga(() => listarAvisos({ rubro: a.rubro }, 4), [a.id]);
  const meta = [a.tipo, a.operacion === "alquiler" ? "Alquiler" : "Venta", a.pueblo, a.zona].filter(Boolean).join(" · ");
  const bajo = a.precioAnterior !== null && a.precio !== null && a.precio < a.precioAnterior;

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Estás en">
        <a href={ir("inicio")}>Inicio</a> › <a href={ir(R.ruta)}>{R.nombre}</a> › <span>{a.tipo}</span>
      </nav>
      <div className="aviso-grid">
        <div className="galeria">
          <div className="foto-main">
            {fotos[foto] ? <img src={fotos[foto]} alt={`Foto del aviso: ${a.titulo}`} width={640} height={420} /> : <div className="sin-foto">Sin foto</div>}
            {a.ejemplo && <span className="tag tag-ej big">Aviso de ejemplo</span>}
          </div>
          {fotos.length > 1 && (
            <div className="thumbs">
              {fotos.map((f, i) => (
                <button key={f} type="button" aria-label={`Ver foto ${i + 1}`} aria-current={i === foto} onClick={() => setFoto(i)}>
                  <img src={f} alt="" width={120} height={80} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="aviso-info">
          <p className="meta">{meta}</p>
          <h1>{a.titulo}</h1>
          <p className="price big">
            {precioTexto(a)}
            {porMes(a) && <span> por mes</span>}
          </p>
          {bajo && a.precioAnterior !== null && (
            <p className="baja">Bajó de precio: antes {a.moneda === "ARS" ? "$" : "USD"} {fmtNum(a.precioAnterior)}</p>
          )}
          <Contacto a={a} />
          <ul className="datos">
            {a.datos.map((d) => <li key={d}>{d}</li>)}
            {a.permuta && <li className="ok">Acepta permuta</li>}
            {a.financia && <li className="ok">Financia</li>}
          </ul>
          {a.descripcion && <p className="desc">{a.descripcion}</p>}
          <p className="small">Publicado el {fmtFecha(new Date(a.publicadoEn))}. Se muestra hasta el {fmtFecha(new Date(a.venceEn))}.</p>
          {!a.ejemplo && <Compartir a={a} />}
        </div>
      </div>
      {otros.estado === "listo" && otros.datos.avisos.some((x) => x.id !== a.id) && (
        <>
          <div className="sec-h"><h2>Más avisos de {R.nombre.toLowerCase()}</h2><a href={ir(R.ruta)}>Ver todos</a></div>
          <div className="grid">{otros.datos.avisos.filter((x) => x.id !== a.id).slice(0, 3).map((x) => <Tarjeta key={x.id} aviso={x} />)}</div>
        </>
      )}
    </div>
  );
}

/** El teléfono del dueño lo da el backend recién cuando tocan el botón. */
function Contacto({ a }: { a: AvisoPublico }) {
  const [estado, setEstado] = useState<"" | "pidiendo" | "listo">("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  if (a.ejemplo)
    return (
      <div className="contacto">
        <button type="button" className="btn btn-wa" disabled>Hablar por WhatsApp con el dueño</button>
        <p className="nota-ej">Aviso de ejemplo: está para que veas cómo se ve. No tiene un dueño real para contactar.</p>
      </div>
    );
  const pedir = async () => {
    setEstado("pidiendo");
    setError("");
    try {
      const r = await linkContacto(a.id);
      setUrl(r.url);
      setEstado("listo");
      window.location.assign(r.url); // en el celular abre WhatsApp directo; si no, queda el botón

    } catch (e) {
      setEstado("");
      setError(e instanceof ErrorApi ? e.message : "No se pudo abrir el contacto. Probá de nuevo.");
    }
  };
  return (
    <div className="contacto">
      {estado === "listo" ? (
        <a className="btn btn-wa" href={url} target="_blank" rel="noopener noreferrer">Abrir WhatsApp con el dueño</a>
      ) : (
        <button type="button" className="btn btn-wa" onClick={pedir} disabled={estado === "pidiendo"}>
          {estado === "pidiendo" ? "Un segundo…" : "Hablar por WhatsApp con el dueño"}
        </button>
      )}
      {error && <p className="err" role="alert">{error}</p>}
      <p className="small">Hablás directo con quien publicó. Vidriera Chabás no cobra comisión ni participa de la operación.</p>
    </div>
  );
}

/** Link para compartir el aviso por WhatsApp (con foto y título en la vista previa). */
function Compartir({ a }: { a: AvisoPublico }) {
  const link = `${window.location.origin}/a/${a.id}`;
  const texto = `${a.titulo} · ${precioTexto(a)} — ${link}`;
  return (
    <p className="compartir">
      <a className="btn btn-line" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
    </p>
  );
}
