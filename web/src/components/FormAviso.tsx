import { useState, type FormEvent, type ReactNode } from "react";
import { LIMITES, RUBRO_IDS, RUBROS } from "../../../shared/config.ts";
import { fmtNum, soloDigitos } from "../../../shared/texto.ts";
import type { ErrorCampo, NuevoAviso, RubroId } from "../../../shared/tipos.ts";
import { validarAviso } from "../../../shared/validar.ts";
import { achicarFoto } from "../fotos.ts";
import { IconoRubro } from "./Iconos.tsx";

export interface ValoresForm {
  rubro: RubroId | "";
  tipo: string;
  operacion: "venta" | "alquiler";
  titulo: string;
  precio: string;
  moneda: "USD" | "ARS";
  permuta: boolean;
  financia: boolean;
  descripcion: string;
  nombre: string;
  telefono: string;
  fotos: string[];
}

export const valoresIniciales = (rubro: RubroId | ""): ValoresForm => ({
  rubro, tipo: "", operacion: "venta", titulo: "", precio: "", moneda: "USD", permuta: false, financia: false, descripcion: "", nombre: "", telefono: "", fotos: [],
});

export const aNuevoAviso = (v: ValoresForm): unknown => ({ ...v, precio: v.precio, datos: [], zona: "" });

/** Mensaje de WhatsApp con todos los datos (se usa cuando no hay servidor o si la persona prefiere mandarlo así). */
export function mensajeWhatsApp(v: ValoresForm): string {
  const r = v.rubro ? RUBROS[v.rubro] : null;
  const L = ["Hola! Quiero publicar un aviso en Vidriera Chabás.", ""];
  L.push(`Rubro: ${r?.nombre ?? "-"}`, `Tipo: ${v.tipo || "-"}`);
  if (v.rubro === "inmuebles") L.push(`Operación: ${v.operacion === "alquiler" ? "Alquiler" : "Venta"}`);
  L.push(`Título: ${v.titulo.trim() || "-"}`);
  const p = soloDigitos(v.precio);
  L.push(`Precio: ${p ? `${fmtNum(Number(p))} ${v.moneda === "ARS" ? "Pesos ($)" : "Dólares (USD)"}${v.operacion === "alquiler" && v.rubro === "inmuebles" ? " por mes" : ""}` : "A consultar"}`);
  if (v.permuta) L.push("Acepta permuta: Sí");
  if (v.financia) L.push("Financia: Sí");
  L.push(`Descripción: ${v.descripcion.trim() || "-"}`, "Pueblo: Chabás", `Nombre: ${v.nombre.trim() || "-"}`, `WhatsApp para que me contacten: ${soloDigitos(v.telefono) || "-"}`, "", "Ahora te mando las fotos por acá.");
  return L.join("\n");
}

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
}

export function FormAviso({ valores: v, onCambio, onEnviar, exigirFotos, enviando, erroresServidor, textoBoton, pie }: Props) {
  const [errores, setErrores] = useState<ErrorCampo[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [errFoto, setErrFoto] = useState("");
  const todos = [...errores, ...erroresServidor];
  const err = (c: string) => todos.find((e) => e.campo === c)?.msg ?? "";
  const set = <K extends keyof ValoresForm>(k: K, valor: ValoresForm[K]) => {
    onCambio({ ...v, [k]: valor });
    if (errores.length) setErrores(errores.filter((e) => e.campo !== k));
  };
  const R = v.rubro ? RUBROS[v.rubro] : null;

  const agregarFotos = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setErrFoto("");
    setProcesando(true);
    const nuevas: string[] = [];
    for (const archivo of Array.from(lista).slice(0, LIMITES.fotos - v.fotos.length)) {
      try {
        nuevas.push(await achicarFoto(archivo));
      } catch (e) {
        setErrFoto(e instanceof Error ? e.message : "No se pudo agregar una foto.");
      }
    }
    setProcesando(false);
    set("fotos", [...v.fotos, ...nuevas].slice(0, LIMITES.fotos));
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const r = validarAviso(aNuevoAviso(v), { exigirFotos });
    setErrores(r.errores);
    if (!r.ok) {
      document.getElementById(r.errores[0]?.campo === "rubro" ? "rubro-inmuebles" : `f-${r.errores[0]?.campo}`)?.focus();
      return;
    }
    onEnviar(r.valor);
  };

  return (
    <form className="form" noValidate onSubmit={enviar}>
      <fieldset>
        <legend>1. ¿Qué querés publicar?</legend>
        <div className="rubro-pick">
          {RUBRO_IDS.map((r) => (
            <label key={r}>
              <input type="radio" name="rubro" id={`rubro-${r}`} value={r} checked={v.rubro === r}
                onChange={() => onCambio({ ...v, rubro: r, tipo: RUBROS[r].tipos.includes(v.tipo) ? v.tipo : "", operacion: r === "inmuebles" ? v.operacion : "venta" })} />
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
                <label key={o}><input type="radio" name="operacion" checked={v.operacion === o} onChange={() => set("operacion", o)} /><span>{o === "venta" ? "Venta" : "Alquiler"}</span></label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="lbl" htmlFor="f-titulo">2. Título del aviso</label>
        <input id="f-titulo" type="text" maxLength={LIMITES.titulo} autoComplete="off" placeholder={R?.placeholder ?? "Ej: Casa de 2 dormitorios con patio"}
          value={v.titulo} aria-invalid={!!err("titulo") || undefined} onChange={(e) => set("titulo", e.target.value)} />
        {err("titulo") && <p className="err">{err("titulo")}</p>}
      </div>

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
        <label className="check"><input type="checkbox" checked={v.permuta} onChange={(e) => set("permuta", e.target.checked)} /> Acepto permuta</label>
        <label className="check"><input type="checkbox" checked={v.financia} onChange={(e) => set("financia", e.target.checked)} /> Ofrezco financiación</label>
      </div>
      <div>
        <label className="lbl" htmlFor="f-descripcion">Descripción <span className="opc">(opcional)</span></label>
        <textarea id="f-descripcion" maxLength={LIMITES.descripcion} placeholder="Estado, medidas, año, kilómetros, qué incluye…" value={v.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
      </div>

      <fieldset>
        <legend>3. Fotos {exigirFotos ? "" : <span className="opc">(opcional)</span>}</legend>
        <div className="fotos-pick">
          {v.fotos.map((f, i) => (
            <div key={i} className="foto-mini">
              <img src={f} alt={`Foto ${i + 1}`} />
              <button type="button" aria-label={`Sacar foto ${i + 1}`} onClick={() => set("fotos", v.fotos.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {v.fotos.length < LIMITES.fotos && (
            <label className="foto-add" htmlFor="f-fotos">
              <span aria-hidden="true">+</span>{procesando ? "Preparando…" : v.fotos.length ? "Agregar más" : "Agregar fotos"}
            </label>
          )}
        </div>
        <input id="f-fotos" className="sr" type="file" accept="image/*" multiple onChange={(e) => { void agregarFotos(e.target.files); e.target.value = ""; }} />
        <p className="small">Hasta {LIMITES.fotos} fotos, con luz de día. La primera es la de tapa.</p>
        {(err("fotos") || errFoto) && <p className="err">{err("fotos") || errFoto}</p>}
      </fieldset>

      <fieldset>
        <legend>4. Tus datos</legend>
        <div className="dos-col">
          <div>
            <label className="lbl" htmlFor="f-nombre">Tu nombre</label>
            <input id="f-nombre" type="text" maxLength={LIMITES.nombre} autoComplete="given-name" value={v.nombre} aria-invalid={!!err("nombre") || undefined} onChange={(e) => set("nombre", e.target.value)} />
            {err("nombre") && <p className="err">{err("nombre")}</p>}
          </div>
          <div>
            <label className="lbl" htmlFor="f-telefono">Tu WhatsApp <span className="opc">(con código de área)</span></label>
            <input id="f-telefono" type="tel" inputMode="tel" maxLength={20} placeholder="Código de área y número" autoComplete="tel" value={v.telefono}
              aria-invalid={!!err("telefono") || undefined} onChange={(e) => set("telefono", e.target.value.replace(/[^\d\s-]/g, ""))} />
            {err("telefono") && <p className="err">{err("telefono")}</p>}
          </div>
        </div>
        <p className="small">Tu número no se muestra en la página: lo usamos para que los interesados te escriban cuando tocan el botón.</p>
      </fieldset>

      {todos.length > 0 && <p className="form-err" role="alert">{todos.length === 1 ? "Falta completar un dato (está marcado en rojo)." : `Faltan completar ${todos.length} datos (están marcados en rojo).`}</p>}
      <button type="submit" className="btn btn-main btn-xl" disabled={enviando || procesando}>{enviando ? "Enviando…" : textoBoton}</button>
      {pie}
    </form>
  );
}
