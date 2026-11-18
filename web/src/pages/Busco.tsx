import { useState, type FormEvent } from "react";
import { WA_NUMERO } from "../../../shared/config.ts";
import type { ErrorCampo, NuevaBusqueda } from "../../../shared/tipos.ts";
import { validarBusqueda } from "../../../shared/validar.ts";
import { linkWA, numeroWA } from "../../../shared/whatsapp.ts";
import { ErrorApi, SinServidor, guardarBusqueda } from "../api.ts";
import { FaltaWhatsApp } from "../components/Pueblos.tsx";
import { useTitulo } from "../hooks.ts";
import { ir } from "../router.ts";

const OPCIONES = ["Casa o departamento para comprar", "Casa o departamento para alquilar", "Terreno", "Galpón o local", "Auto o camioneta", "Moto", "Maquinaria agro o herramientas", "Otra cosa"];

const mensaje = (b: NuevaBusqueda): string =>
  ["Hola! Estoy buscando esto en Chabás y la zona:", "", `Rubro: ${b.rubro || "-"}`, `Busco: ${b.que || "-"}`, `Presupuesto: ${b.presupuesto || "-"}`, `Nombre: ${b.nombre || "-"}`, "", "Si aparece algo así, avisame por acá."].join("\n");

export function Busco() {
  useTitulo("Avisame cuando aparezca");
  const [b, setB] = useState<NuevaBusqueda>({ rubro: "", que: "", presupuesto: "", nombre: "", telefono: "" });
  const [errores, setErrores] = useState<ErrorCampo[]>([]);
  const [estado, setEstado] = useState<"" | "enviando" | "ok" | "whatsapp">("");
  const [error, setError] = useState("");
  const err = (c: string) => errores.find((e) => e.campo === c)?.msg ?? "";
  const set = (k: keyof NuevaBusqueda, v: string) => { setB({ ...b, [k]: v }); setErrores(errores.filter((e) => e.campo !== k)); };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const r = validarBusqueda(b);
    setErrores(r.errores);
    if (!r.ok) return;
    setEstado("enviando");
    setError("");
    try {
      await guardarBusqueda(r.valor);
      setEstado("ok");
    } catch (x) {
      if (x instanceof SinServidor) setEstado("whatsapp");
      else {
        setEstado("");
        if (x instanceof ErrorApi) { setErrores(x.campos); setError(x.campos.length ? "" : x.message); }
        else setError("Algo salió mal. Probá de nuevo.");
      }
    }
  };

  if (estado === "ok")
    return (
      <div className="wrap prose listo">
        <img src="assets/img/isotipo-claro.svg" alt="" width={80} height={91} />
        <h1>¡Anotado!</h1>
        <p>Cuando alguien publique algo parecido, te avisamos por WhatsApp. Si ya no buscás, escribinos y te sacamos de la lista.</p>
        <p><a className="btn btn-main" href={ir("buscar")}>Ver los avisos de ahora</a></p>
      </div>
    );

  return (
    <div className="wrap">
      <div className="page-h">
        <h1>Avisame cuando <em>aparezca.</em></h1>
        <p>Contanos qué buscás. Cuando alguien publique algo parecido, te avisamos por WhatsApp. Es gratis y no te compromete a nada.</p>
      </div>
      {estado === "whatsapp" ? (
        <div className="form">
          <h2>Mandalo por WhatsApp</h2>
          {numeroWA(WA_NUMERO) ? <a className="btn btn-wa btn-xl" href={linkWA(WA_NUMERO, mensaje(b))} target="_blank" rel="noopener noreferrer">Mandar por WhatsApp</a> : <FaltaWhatsApp />}
        </div>
      ) : (
        <form className="form" noValidate onSubmit={(e) => void enviar(e)}>
          <div>
            <label className="lbl" htmlFor="b-rubro">¿Qué buscás?</label>
            <select id="b-rubro" value={b.rubro} aria-invalid={!!err("rubro") || undefined} onChange={(e) => set("rubro", e.target.value)}>
              <option value="">Elegí una opción</option>
              {OPCIONES.map((o) => <option key={o}>{o}</option>)}
            </select>
            {err("rubro") && <p className="err">{err("rubro")}</p>}
          </div>
          <div>
            <label className="lbl" htmlFor="b-que">Contanos un poco más</label>
            <input id="b-que" type="text" maxLength={160} placeholder="Ej: depto de 1 dormitorio, cerca del centro" value={b.que} aria-invalid={!!err("que") || undefined} onChange={(e) => set("que", e.target.value)} />
            {err("que") && <p className="err">{err("que")}</p>}
          </div>
          <div className="dos-col">
            <div>
              <label className="lbl" htmlFor="b-presupuesto">Presupuesto <span className="opc">(opcional)</span></label>
              <input id="b-presupuesto" type="text" maxLength={40} placeholder="Ej: hasta $ 400.000 por mes" value={b.presupuesto} onChange={(e) => set("presupuesto", e.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="b-nombre">Tu nombre</label>
              <input id="b-nombre" type="text" maxLength={40} autoComplete="given-name" value={b.nombre} aria-invalid={!!err("nombre") || undefined} onChange={(e) => set("nombre", e.target.value)} />
              {err("nombre") && <p className="err">{err("nombre")}</p>}
            </div>
          </div>
          <div>
            <label className="lbl" htmlFor="b-telefono">Tu WhatsApp <span className="opc">(para avisarte)</span></label>
            <input id="b-telefono" type="tel" inputMode="tel" maxLength={20} placeholder="Código de área y número" autoComplete="tel" value={b.telefono}
              aria-invalid={!!err("telefono") || undefined} onChange={(e) => set("telefono", e.target.value.replace(/[^\d\s-]/g, ""))} />
            {err("telefono") && <p className="err">{err("telefono")}</p>}
          </div>
          {error && <p className="form-err" role="alert">{error}</p>}
          <button type="submit" className="btn btn-main btn-xl" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Avisame cuando aparezca"}</button>
          <p className="small">Usamos tu número solo para avisarte. Si ya no buscás, escribinos y te sacamos de la lista.</p>
        </form>
      )}
    </div>
  );
}
