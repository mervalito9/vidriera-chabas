// Formulario de aviso: lo usan "Publicá gratis" (el vecino) y el panel (Felipe, con más campos: avanzado).
import { useState, type FormEvent, type ReactNode } from "react";
import { LIMITES, OTRO_PUEBLO, PUEBLOS, RUBRO_IDS, RUBROS } from "../../../../shared/config.ts";
import type { ErrorCampo, NuevoAviso } from "../../../../shared/tipos.ts";
import { validarAviso } from "../../../../shared/validar.ts";
import { IconoRubro } from "../Iconos.tsx";
import { MAPA_ACTIVO } from "../../mapa/activo.ts";
import { MarcarUbicacion } from "../../mapa/MarcarUbicacion.tsx";
import { ElegirCliente, QUIENES, textoPublica, type Cliente } from "./Cliente.tsx";
import { CondicionesAlquiler } from "./CondicionesAlquiler.tsx";
import { DatosGuiados } from "./DatosGuiados.tsx";
import { ElegirFotos } from "./ElegirFotos.tsx";
import { Encuadre } from "./Encuadre.tsx";
import { aNuevoAviso, monedaSugerida, type ValoresForm } from "./valores.ts";

/** Tipos de inmueble donde no se pregunta por mascotas ni muebles. */
const NO_VIVIENDA = ["Galpón o local", "Terreno"];

export { mensajeWhatsApp, valoresIniciales, type ValoresForm } from "./valores.ts";

interface Props {
  valores: ValoresForm;
  onCambio: (v: ValoresForm) => void;
  /** Se llama con el aviso ya validado */
  onEnviar: (a: NuevoAviso) => void;
  exigirFotos: boolean;
  enviando: boolean;
  erroresServidor: ErrorCampo[];
  textoBoton: string;
  pie?: ReactNode;
  /** En el panel: muestra zona, datos libres y el cliente, con textos para Felipe en vez de para el vecino */
  avanzado?: boolean;
  /** En el panel: los clientes que ya cargó, para elegirlos de una lista */
  clientes?: Cliente[];
}

export function FormAviso({ valores: v, onCambio, onEnviar, exigirFotos, enviando, erroresServidor, textoBoton, pie, avanzado, clientes = [] }: Props) {
  const [errores, setErrores] = useState<ErrorCampo[]>([]);
  const [procesando, setProcesando] = useState(false);
  const todos = [...errores, ...erroresServidor];
  const err = (c: string) => todos.find((e) => e.campo === c)?.msg ?? "";
  const set = <K extends keyof ValoresForm>(k: K, valor: ValoresForm[K]) => {
    onCambio({ ...v, [k]: valor });
    if (errores.length) setErrores(errores.filter((e) => e.campo !== k));
  };
  const R = v.rubro ? RUBROS[v.rubro] : null;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const r = validarAviso(aNuevoAviso(v), { exigirFotos });
    setErrores(r.errores);
    if (!r.ok) {
      const campo = r.errores[0]?.campo;
      const id = campo === "rubro" ? "rubro-inmuebles" : campo === "pueblo" && v.pueblo === OTRO_PUEBLO ? "f-pueblo-otro" : campo === "pueblo" ? "f-pueblo" : `f-${campo}`;
      document.getElementById(id)?.focus();
      return;
    }
    onEnviar(r.valor);
  };

  return (
    <form className="form" noValidate onSubmit={enviar}>
      <fieldset>
        <legend>{avanzado ? "1. ¿Qué es?" : "1. ¿Qué querés publicar?"}</legend>
        <div className="rubro-pick">
          {RUBRO_IDS.map((r) => (
            <label key={r}>
              <input type="radio" name="rubro" id={`rubro-${r}`} value={r} checked={v.rubro === r}
                onChange={() => {
                  onCambio({ ...v, rubro: r, tipo: RUBROS[r].tipos.includes(v.tipo) ? v.tipo : "", operacion: r === "inmuebles" ? v.operacion : "venta", moneda: monedaSugerida(r, r === "inmuebles" ? v.operacion : "venta", v) });
                  setErrores(errores.filter((x) => x.campo !== "rubro"));
                }} />
              <span><IconoRubro rubro={r} color="#17150F" />{r === "inmuebles" ? "Inmueble" : r === "vehiculos" ? "Vehículo" : "Maquinaria agro"}</span>
            </label>
          ))}
        </div>
        {err("rubro") && <p className="err">{err("rubro")}</p>}
      </fieldset>

      <div className="dos-col">
        <div>
          <label className="lbl" htmlFor="f-tipo">Tipo</label>
          <select id="f-tipo" value={v.tipo} disabled={!R} aria-invalid={!!err("tipo") || undefined} onChange={(e) => set("tipo", e.target.value)}>
            <option value="">{R ? "Elegí una opción" : "Primero elegí qué querés publicar"}</option>
            {R?.tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {err("tipo") && <p className="err">{err("tipo")}</p>}
        </div>
        {v.rubro === "inmuebles" && (
          <div>
            <span className="lbl" id="opL">¿Venta o alquiler?</span>
            <div className="seg dos" role="radiogroup" aria-labelledby="opL">
              {(["venta", "alquiler"] as const).map((o) => (
                <label key={o}><input type="radio" name="operacion" checked={v.operacion === o} onChange={() => onCambio({ ...v, operacion: o, moneda: monedaSugerida(v.rubro, o, v) })} /><span>{o === "venta" ? "Venta" : "Alquiler"}</span></label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="lbl" htmlFor="f-titulo">2. Título del aviso</label>
        <input id="f-titulo" type="text" maxLength={LIMITES.titulo} autoComplete="off" placeholder={R?.placeholder ?? "Ej: Casa de 2 dormitorios con patio"}
          value={v.titulo} aria-invalid={!!err("titulo") || undefined} onChange={(e) => set("titulo", e.target.value)} />
        {err("titulo") ? <p className="err">{err("titulo")}</p> : v.titulo.trim().length > 0 && v.titulo.trim().length < 18 && (
          <p className="small consejo">Tip: un buen título dice qué es y lo que lo hace distinto. {R?.placeholder ?? "Ej: Casa de 3 dormitorios con patio"}</p>
        )}
      </div>

      <fieldset className="donde">
        <legend id="puebloL">¿Dónde está?</legend>
        <p className="small">El pueblo donde está lo que publicás, aunque vos vivas en otro.</p>
        <div className="pueblo-pick" role="radiogroup" aria-labelledby="puebloL" aria-invalid={!!err("pueblo") || undefined}>
          {[...PUEBLOS, OTRO_PUEBLO].map((p, i) => (
            <label key={p}>
              <input type="radio" name="pueblo" id={i === 0 ? "f-pueblo" : undefined} value={p} checked={v.pueblo === p} onChange={() => set("pueblo", p)} />
              <span>{p === OTRO_PUEBLO ? "Otro (escribilo)" : p}</span>
            </label>
          ))}
        </div>
        {v.pueblo === OTRO_PUEBLO && (
          <div className="pueblo-otro">
            <label className="lbl" htmlFor="f-pueblo-otro">Nombre del pueblo</label>
            <input id="f-pueblo-otro" type="text" maxLength={40} autoComplete="off" placeholder="Ej: Arequito" value={v.puebloOtro}
              aria-invalid={!!err("pueblo") || undefined} onChange={(e) => { onCambio({ ...v, puebloOtro: e.target.value }); setErrores(errores.filter((x) => x.campo !== "pueblo")); }} />
          </div>
        )}
        {err("pueblo") && <p className="err">{err("pueblo")}</p>}
      </fieldset>

      <div className="dos-col">
        <div>
          <label className="lbl" htmlFor="f-precio">Precio <span className="opc">(solo números)</span></label>
          <input id="f-precio" type="text" inputMode="numeric" maxLength={12} placeholder="Ej: 15000" autoComplete="off" value={v.precio}
            aria-invalid={!!err("precio") || undefined} onChange={(e) => set("precio", e.target.value.replace(/\D+/g, ""))} />
          {err("precio") && <p className="err">{err("precio")}</p>}
        </div>
        <div>
          <label className="lbl" htmlFor="f-moneda">Moneda</label>
          <select id="f-moneda" value={v.moneda} onChange={(e) => set("moneda", e.target.value === "ARS" ? "ARS" : "USD")}>
            <option value="USD">Dólares (USD)</option>
            <option value="ARS">Pesos ($)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="check"><input type="checkbox" checked={v.permuta} onChange={(e) => set("permuta", e.target.checked)} /> {avanzado ? "Acepta permuta" : "Acepto permuta"}</label>
        <label className="check"><input type="checkbox" checked={v.financia} onChange={(e) => set("financia", e.target.checked)} /> {avanzado ? "Financia" : "Ofrezco financiación"}</label>
      </div>
      {v.rubro && <DatosGuiados key={v.rubro} rubro={v.rubro} datos={v.datos} onCambio={(d) => set("datos", d)} />}
      {MAPA_ACTIVO && v.rubro === "inmuebles" && (
        <MarcarUbicacion lat={v.lat} lng={v.lng} pueblo={v.pueblo} onCambio={(lat, lng) => onCambio({ ...v, lat, lng })} />
      )}
      {v.rubro === "inmuebles" && v.operacion === "alquiler" && (
        <CondicionesAlquiler valor={v.condiciones} esVivienda={!NO_VIVIENDA.includes(v.tipo)} onCambio={(c) => set("condiciones", c)} />
      )}
      <div>
        <label className="lbl" htmlFor="f-descripcion">Descripción <span className="opc">(opcional)</span></label>
        <textarea id="f-descripcion" maxLength={LIMITES.descripcion} placeholder="Estado, medidas, año, kilómetros, qué incluye…" value={v.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
      </div>

      <ElegirFotos fotos={v.fotos} exigir={exigirFotos} error={err("fotos")} onCambio={(f) => set("fotos", f)} onProcesando={setProcesando} />
      {avanzado && v.fotos[0] && <Encuadre foto={v.fotos[0]} foco={v.foco} onCambio={(f) => set("foco", f)} />}

      {avanzado && (
        <div className="dos-col">
          <div>
            <label className="lbl" htmlFor="f-zona">Zona o barrio <span className="opc">(opcional)</span></label>
            <input id="f-zona" type="text" maxLength={60} autoComplete="off" value={v.zona} onChange={(e) => set("zona", e.target.value)} />
          </div>
          <div>
            <label className="lbl" htmlFor="f-datos">Otros datos destacados <span className="opc">(separados por coma)</span></label>
            <input id="f-datos" type="text" maxLength={200} placeholder="Ej: 2 dormitorios, cochera, patio" autoComplete="off" value={v.datos} onChange={(e) => set("datos", e.target.value)} />
          </div>
        </div>
      )}

      <fieldset>
        <legend>{avanzado ? "4. Cliente: quién publica" : "4. Tus datos"}</legend>
        {avanzado && (
          <>
            <ElegirCliente clientes={clientes} onElegir={(c) => onCambio({ ...v, nombre: c.nombre, telefono: c.telefono, anunciante: c.anunciante, quien: c.quien || "dueno" })} />
            <span className="lbl" id="quienL">¿Quién es?</span>
            <div className="seg" role="radiogroup" aria-labelledby="quienL">
              {QUIENES.map(([q, t]) => (
                <label key={q}><input type="radio" name="quien" checked={v.quien === q} onChange={() => set("quien", q)} /><span>{t}</span></label>
              ))}
            </div>
          </>
        )}
        <div className="dos-col">
          <div>
            <label className="lbl" htmlFor="f-nombre">{avanzado ? (v.quien === "dueno" ? "Nombre del dueño" : "Nombre de quien atiende") : "Tu nombre"}</label>
            <input id="f-nombre" type="text" maxLength={LIMITES.nombre} autoComplete="given-name" value={v.nombre} aria-invalid={!!err("nombre") || undefined} onChange={(e) => set("nombre", e.target.value)} />
            {err("nombre") && <p className="err">{err("nombre")}</p>}
          </div>
          <div>
            <label className="lbl" htmlFor="f-telefono">{avanzado ? "WhatsApp" : "Tu WhatsApp"} <span className="opc">(con código de área)</span></label>
            <input id="f-telefono" type="tel" inputMode="tel" maxLength={22} placeholder="Ej: 3464 40-1234" autoComplete="tel" value={v.telefono}
              aria-invalid={!!err("telefono") || undefined} onChange={(e) => set("telefono", e.target.value.replace(/[^\d\s()+-]/g, ""))} />
            {err("telefono") && <p className="err">{err("telefono")}</p>}
          </div>
        </div>
        {avanzado && v.quien && v.quien !== "dueno" && (
          <div>
            <label className="lbl" htmlFor="f-anunciante">Nombre {v.quien === "agencia" ? "de la agencia" : "de la inmobiliaria"}</label>
            <input id="f-anunciante" type="text" maxLength={60} placeholder={v.quien === "agencia" ? "Ej: Agencia Di Giovanni" : "Ej: Inmobiliaria Pérez"} autoComplete="off" value={v.anunciante} onChange={(e) => set("anunciante", e.target.value)} />
          </div>
        )}
        {avanzado && textoPublica(v) && <p className="small">En el aviso se va a ver: <b>Publica: {textoPublica(v)}</b>{v.quien === "dueno" ? " (dueño)" : ""}</p>}
        {!avanzado && <p className="small">En el aviso se ve tu nombre (solo el primero). Tu número no se muestra: lo usamos para que los interesados te escriban cuando tocan el botón.</p>}
      </fieldset>

      {todos.length > 0 && <p className="form-err" role="alert">{todos.length === 1 ? "Falta completar un dato (está marcado en rojo)." : `Faltan completar ${todos.length} datos (están marcados en rojo).`}</p>}
      <button type="submit" className="btn btn-main btn-xl" disabled={enviando || procesando}>{enviando ? "Enviando…" : textoBoton}</button>
      {pie}
    </form>
  );
}
