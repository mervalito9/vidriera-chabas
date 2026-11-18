import { useEffect, useState } from "react";
import { OTRO_PUEBLO, PUEBLOS, RUBROS } from "../../../shared/config.ts";
import { claveFoto, fichaAAviso, leerFichas, MAX_FOTOS_AVISO, type FichaLista } from "../../../shared/lote.ts";
import type { NuevoAviso } from "../../../shared/tipos.ts";
import { validarAviso } from "../../../shared/validar.ts";
import { ErrorApi, admin } from "../api.ts";
import { FormAviso, type ValoresForm } from "../components/FormAviso.tsx";
import { achicarFoto } from "../fotos.ts";
import { precioTexto } from "../formato.ts";
import { abrirZip, type EntradaZip } from "../zipleer.ts";

interface Fila extends FichaLista {
  /** Fotos del zip que le tocan a este aviso, en orden */
  fotos: EntradaZip[];
  /** Fotos ya achicadas (cuando se abrió el editor); si están, mandan sobre `fotos`. */
  fotosListas?: string[];
  fotosFaltan: string[];
  /** Miniatura de la tapa */
  tapa?: string;
  estado: "listo" | "cargando" | "cargado" | "fallo";
  detalle?: string;
}

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };
const extDe = (n: string) => (n.split(".").pop() ?? "").toLowerCase();
const esFoto = (n: string) => extDe(n) in MIME;
const natural = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });

async function achicarEntrada(e: EntradaZip): Promise<string> {
  return achicarFoto(new File([(await e.leer()) as BlobPart], e.nombre.split("/").pop() ?? "foto", { type: MIME[extDe(e.nombre)] }));
}

/** Vuelve a revisar un borrador después de editarlo (a mano o en masa). */
function revalidar(f: Fila, b: Fila["borrador"]): Fila {
  const r = validarAviso(b, { exigirFotos: false });
  const errores = r.errores.map((e) => e.msg);
  if (!b.rubro) errores.unshift("Elegí el rubro.");
  const avisos = f.avisos.filter((x) => !(/^Falta: precio/.test(x) && r.valor.precio !== null) && !(/^Falta: descripción/.test(x) && r.valor.descripcion.length >= 10));
  return { ...f, borrador: { ...r.valor, rubro: b.rubro, fotos: [] }, aviso: errores.length ? null : { ...r.valor, fotos: [] }, errores: [...new Set(errores)], avisos, estado: f.estado === "fallo" ? "listo" : f.estado };
}

const aValores = (b: Fila["borrador"], fotos: string[]): ValoresForm => ({
  rubro: b.rubro, tipo: b.tipo, operacion: b.operacion, titulo: b.titulo, precio: b.precio === null ? "" : String(b.precio), moneda: b.moneda,
  permuta: b.permuta, financia: b.financia, descripcion: b.descripcion, nombre: b.nombre, telefono: b.telefono, fotos, zona: b.zona,
  datos: b.datos.join(", "), anunciante: b.anunciante,
  pueblo: !b.pueblo ? "" : PUEBLOS.includes(b.pueblo) ? b.pueblo : OTRO_PUEBLO, puebloOtro: !b.pueblo || PUEBLOS.includes(b.pueblo) ? "" : b.pueblo,
});

/** "Cargar varios": subís el .zip (fichas + fotos), lo revisás, completás lo que falta y entran todos como pendientes. */
export function CargarVarios({ onListo }: { onListo: () => void }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [sobrantes, setSobrantes] = useState<string[]>([]);
  const [editando, setEditando] = useState<number | null>(null);

  // Libera las miniaturas al salir
  useEffect(() => () => filas?.forEach((f) => f.tapa && URL.revokeObjectURL(f.tapa)), [filas === null]); // eslint-disable-line react-hooks/exhaustive-deps

  async function elegir(archivo: File) {
    setError("");
    setLeyendo(true);
    setFilas(null);
    setEditando(null);
    try {
      let texto = "";
      let fotos: EntradaZip[] = [];
      if (/\.zip$/i.test(archivo.name)) {
        const entradas = await abrirZip(await archivo.arrayBuffer());
        const txt = entradas.filter((e) => /\.(txt|md)$/i.test(e.nombre)).sort((a, b) => Number(/fichas/i.test(b.nombre)) - Number(/fichas/i.test(a.nombre)) || natural(a.nombre, b.nombre));
        if (!txt.length) throw new Error("Adentro del .zip no encontré el archivo de fichas (.txt).");
        texto = new TextDecoder().decode(await txt[0]!.leer());
        fotos = entradas.filter((e) => esFoto(e.nombre));
      } else {
        texto = await archivo.text();
      }
      const fichas = leerFichas(texto);
      if (!fichas.length) throw new Error('No encontré avisos en las fichas. Cada uno tiene que empezar con "AVISO 01".');
      // Fotos: primero por nombre ("01-2.jpg" = aviso 1, foto 2); si no, por carpeta ("01/loquesea.jpg")
      const porClave = new Map<string, EntradaZip>();
      for (const f of fotos) { const k = claveFoto(f.nombre); if (k && !porClave.has(k)) porClave.set(k, f); }
      const usadas = new Set<EntradaZip>();
      const lista: Fila[] = [];
      for (const f of fichas) {
        const base = fichaAAviso(f);
        let propias = f.fotosRef.map((k) => porClave.get(k)).filter((x): x is EntradaZip => !!x);
        const faltan = f.fotosRef.filter((k) => !porClave.has(k));
        if (!propias.length) {
          propias = fotos.filter((e) => e.nombre.split("/").slice(0, -1).some((s) => /^0*(\d+)\b/.exec(s)?.[1] === f.num)).sort((a, b) => natural(a.nombre, b.nombre));
          if (propias.length) faltan.length = 0;
        }
        propias.forEach((p) => usadas.add(p));
        const primera = propias[0];
        const tapa = primera ? URL.createObjectURL(new Blob([(await primera.leer()) as BlobPart], { type: MIME[extDe(primera.nombre)] })) : undefined;
        lista.push({ ...base, fotos: propias.slice(0, MAX_FOTOS_AVISO), fotosFaltan: faltan, tapa, estado: "listo" });
      }
      setSobrantes(fotos.filter((e) => !usadas.has(e)).map((e) => e.nombre));
      setFilas(lista);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setLeyendo(false);
    }
  }

  const poner = (i: number, c: Partial<Fila> | ((f: Fila) => Fila)) =>
    setFilas((fs) => fs && fs.map((f, j) => (j === i ? (typeof c === "function" ? c(f) : { ...f, ...c }) : f)));

  async function cargar() {
    if (!filas) return;
    setCargando(true);
    setError("");
    setEditando(null);
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i]!;
      if (!f.aviso || f.estado === "cargado") continue;
      poner(i, { estado: "cargando", detalle: undefined });
      try {
        const fotos = f.fotosListas ?? (await Promise.all(f.fotos.map(achicarEntrada)));
        await admin.crear({ ...f.aviso, fotos }, true);
        poner(i, { estado: "cargado" });
      } catch (e) {
        if (e instanceof ErrorApi && e.status === 401) { setError("Se cerró tu sesión. Entrá de nuevo y repetí la carga: los que ya entraron quedan marcados."); setCargando(false); return; }
        poner(i, { estado: "fallo", detalle: e instanceof ErrorApi ? (e.campos[0]?.msg ?? e.message) : e instanceof Error ? e.message : "Falló." });
      }
    }
    setCargando(false);
  }

  const listos = filas?.filter((f) => f.aviso && f.estado !== "cargado") ?? [];
  const cargados = filas?.filter((f) => f.estado === "cargado").length ?? 0;
  const conProblemas = filas?.filter((f) => !f.aviso && f.estado !== "cargado").length ?? 0;
  const terminado = !!filas && !cargando && cargados > 0 && listos.every((f) => f.estado === "fallo") && conProblemas === 0;

  return (
    <div className="lote">
      <h2>Cargar varios avisos</h2>
      <p className="small">Subí el <b>.zip</b> con las fichas y las fotos. Revisás cada uno, completás lo que falte (de a uno con <b>Editar</b>, o a todos juntos arriba) y entran como <b>pendientes</b> para que los apruebes.</p>
      {!cargando && (
        <label className="btn btn-main lote-sel">
          {leyendo ? "Leyendo…" : filas ? "Elegir otro archivo" : "Elegir el .zip"}
          <input type="file" accept=".zip,.txt,.md,application/zip" disabled={leyendo} onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ""; if (a) void elegir(a); }} />
        </label>
      )}
      {error && <p className="form-err" role="alert">{error}</p>}
      {filas && (
        <>
          <p className="lote-res" role="status">
            <b>{listos.length}</b> {listos.length === 1 ? "listo para cargar" : "listos para cargar"}
            {conProblemas > 0 && <> · <b className="err">{conProblemas}</b> {conProblemas === 1 ? "necesita" : "necesitan"} que completes datos</>}
            {cargados > 0 && <> · <b>{cargados}</b> ya cargados</>}
          </p>
          {!cargando && filas.some((f) => f.estado !== "cargado") && (
            <EnMasa onAplicar={(c) => setFilas((fs) => fs && fs.map((f) => {
              if (f.estado === "cargado") return f;
              const b = { ...f.borrador };
              if (c.nombre && !b.nombre) b.nombre = c.nombre;
              if (c.telefono && b.telefono.length < 8) b.telefono = c.telefono;
              if (c.anunciante && (c.pisar || !b.anunciante)) b.anunciante = c.anunciante;
              if (c.pueblo && (c.pisar || !b.pueblo)) b.pueblo = c.pueblo;
              return revalidar(f, b);
            }))} />
          )}
          <ul className="admin-lista">
            {filas.map((f, i) => (
              <li key={f.num + i} className={`admin-item lote-fila ${f.estado}${f.aviso ? "" : " con-error"}`}>
                {editando === i ? (
                  <EditarFila f={f} onCancelar={() => setEditando(null)} onGuardar={(a, fotos) => { poner(i, (x) => ({ ...revalidar(x, { ...a, fotos: [] }), fotosListas: fotos })); setEditando(null); }} />
                ) : (
                  <>
                    {f.tapa ? <img className="admin-foto" src={f.tapa} alt="" width={120} height={80} /> : <div className="admin-foto sin-foto">Sin foto</div>}
                    <div className="admin-datos">
                      <p className="small"><b>#{f.num}</b> {f.borrador.rubro ? RUBROS[f.borrador.rubro].nombre : "Rubro ?"} · {f.borrador.tipo || "tipo ?"} · {f.borrador.operacion} · {f.borrador.pueblo || "pueblo ?"}{f.borrador.anunciante && <> · {f.borrador.anunciante}</>}</p>
                      <h3>{f.borrador.titulo || "(sin título)"}</h3>
                      <p className="small">{precioTexto(f.borrador)} · {(f.fotosListas ?? f.fotos).length} {(f.fotosListas ?? f.fotos).length === 1 ? "foto" : "fotos"} · {f.borrador.nombre || "sin nombre"} · {f.borrador.telefono || "sin WhatsApp"}{f.fotosFaltan.length > 0 && !f.fotosListas && <b className="err"> · no encontré: {f.fotosFaltan.join(", ")}</b>}</p>
                      {f.errores.map((e) => <p key={e} className="err">✗ {e}</p>)}
                      {f.avisos.map((e) => <p key={e} className="small aviso-ojo">⚠ {e}</p>)}
                      {f.estado === "cargando" && <p className="small">Cargando…</p>}
                      {f.estado === "cargado" && <p className="small ok">✓ Cargado como pendiente</p>}
                      {f.estado === "fallo" && <p className="err">✗ No se cargó: {f.detalle}</p>}
                    </div>
                    {f.estado !== "cargado" && !cargando && (
                      <div className="admin-acc">
                        <button type="button" className={`btn ${f.aviso ? "btn-line" : "btn-main"}`} onClick={() => setEditando(i)}>{f.aviso ? "Editar" : "Completar y arreglar"}</button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {sobrantes.length > 0 && <details><summary className="small">{sobrantes.length} fotos del .zip no se asignaron a ningún aviso</summary><p className="small">{sobrantes.slice(0, 40).join(", ")}</p></details>}
          {listos.length > 0 && editando === null && (
            <button type="button" className="btn btn-main lote-cargar" disabled={cargando} onClick={() => void cargar()}>
              {cargando ? "Cargando… no cierres esta pantalla" : `Cargar ${listos.length} ${listos.length === 1 ? "aviso" : "avisos"} como pendientes`}
            </button>
          )}
          {conProblemas > 0 && listos.length > 0 && !cargando && <p className="small">Los que necesitan datos se quedan acá: completalos y volvé a tocar Cargar.</p>}
          {cargados > 0 && !cargando && <button type="button" className="btn btn-line" onClick={onListo}>Ir a Pendientes</button>}
          {terminado && <p className="small ok">Listo: entraron todos.</p>}
        </>
      )}
    </div>
  );
}

/** Completa a todos juntos lo que suele faltar. */
function EnMasa({ onAplicar }: { onAplicar: (c: { nombre: string; telefono: string; anunciante: string; pueblo: string; pisar: boolean }) => void }) {
  const [c, setC] = useState({ nombre: "", telefono: "", anunciante: "", pueblo: "", pisar: false });
  const [hecho, setHecho] = useState(false);
  const set = (k: keyof typeof c, v: string | boolean) => { setC({ ...c, [k]: v }); setHecho(false); };
  return (
    <details className="lote-masa">
      <summary><b>Completar a todos juntos</b> <span className="small">(nombre, WhatsApp, pueblo, "Publicado por")</span></summary>
      <p className="small">Se pone solo en los avisos a los que les falta ese dato. Los ya cargados no se tocan.</p>
      <div className="lote-masa-campos">
        <label><span className="lbl">Nombre de contacto</span><input type="text" maxLength={40} value={c.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Felipe" /></label>
        <label><span className="lbl">WhatsApp de contacto</span><input type="tel" inputMode="numeric" value={c.telefono} onChange={(e) => set("telefono", e.target.value.replace(/\D+/g, ""))} placeholder="Ej: 3464123456" /></label>
        <label><span className="lbl">Pueblo</span>
          <select value={c.pueblo} onChange={(e) => set("pueblo", e.target.value)}>
            <option value="">(no cambiar)</option>
            {PUEBLOS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label><span className="lbl">Publicado por</span><input type="text" maxLength={60} value={c.anunciante} onChange={(e) => set("anunciante", e.target.value)} placeholder="Ej: Dueño directo" /></label>
      </div>
      <label className="check"><input type="checkbox" checked={c.pisar} onChange={(e) => set("pisar", e.target.checked)} /> Pueblo y "Publicado por": ponerlo también en los que ya tienen</label>
      <button type="button" className="btn btn-main" disabled={!c.nombre && c.telefono.length < 8 && !c.anunciante && !c.pueblo} onClick={() => { onAplicar(c); setHecho(true); }}>Aplicar a todos</button>
      {hecho && <span className="small ok" role="status"> ✓ Aplicado</span>}
    </details>
  );
}

/** Editor de un aviso del lote, con sus fotos (se achican al abrir). */
function EditarFila({ f, onGuardar, onCancelar }: { f: Fila; onGuardar: (a: NuevoAviso, fotos: string[]) => void; onCancelar: () => void }) {
  const [v, setV] = useState<ValoresForm | null>(null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const fotos = f.fotosListas ?? (await Promise.all(f.fotos.map((e) => achicarEntrada(e).catch(() => "")))).filter(Boolean);
      if (vivo) setV(aValores(f.borrador, fotos));
    })();
    return () => { vivo = false; };
  }, [f]);
  if (!v) return <p className="small">Preparando las fotos…</p>;
  return (
    <div className="admin-edicion">
      <h3>Aviso #{f.num}</h3>
      {f.avisos.length > 0 && <ul className="small aviso-ojo">{f.avisos.map((x) => <li key={x}>⚠ {x}</li>)}</ul>}
      <FormAviso
        valores={v}
        onCambio={setV}
        exigirFotos={false}
        avanzado
        enviando={false}
        erroresServidor={[]}
        textoBoton="Guardar"
        onEnviar={(a) => onGuardar(a, v.fotos)}
        pie={<button type="button" className="btn btn-line" onClick={onCancelar}>Cancelar</button>}
      />
    </div>
  );
}
