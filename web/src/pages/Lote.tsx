import { useState } from "react";
import { RUBROS } from "../../../shared/config.ts";
import { claveFoto, fichaAAviso, leerFichas, MAX_FOTOS_AVISO, type FichaLista } from "../../../shared/lote.ts";
import { ErrorApi, admin } from "../api.ts";
import { achicarFoto } from "../fotos.ts";
import { precioTexto } from "../formato.ts";
import { abrirZip, type EntradaZip } from "../zipleer.ts";

interface Fila extends FichaLista {
  /** Fotos del zip que le tocan a este aviso, en orden */
  fotos: EntradaZip[];
  fotosFaltan: string[];
  estado: "listo" | "cargando" | "cargado" | "fallo";
  detalle?: string;
}

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };
const extDe = (n: string) => (n.split(".").pop() ?? "").toLowerCase();
const esFoto = (n: string) => extDe(n) in MIME;
const natural = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });

/** "Cargar varios": subís el .zip (fichas + fotos), se revisa y entran todos como pendientes. */
export function CargarVarios({ onListo }: { onListo: () => void }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [sobrantes, setSobrantes] = useState<string[]>([]);

  async function elegir(archivo: File) {
    setError("");
    setLeyendo(true);
    setFilas(null);
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
      const lista: Fila[] = fichas.map((f) => {
        const base = fichaAAviso(f);
        let propias = f.fotosRef.map((k) => porClave.get(k)).filter((x): x is EntradaZip => !!x);
        const faltan = f.fotosRef.filter((k) => !porClave.has(k));
        if (!propias.length) {
          propias = fotos.filter((e) => e.nombre.split("/").slice(0, -1).some((s) => /^0*(\d+)\b/.exec(s)?.[1] === f.num)).sort((a, b) => natural(a.nombre, b.nombre));
          if (propias.length) faltan.length = 0;
        }
        propias.forEach((p) => usadas.add(p));
        return { ...base, fotos: propias.slice(0, MAX_FOTOS_AVISO), fotosFaltan: faltan, estado: "listo" };
      });
      setSobrantes(fotos.filter((e) => !usadas.has(e)).map((e) => e.nombre));
      setFilas(lista);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setLeyendo(false);
    }
  }

  const poner = (i: number, c: Partial<Fila>) => setFilas((fs) => fs && fs.map((f, j) => (j === i ? { ...f, ...c } : f)));

  async function cargar() {
    if (!filas) return;
    setCargando(true);
    setError("");
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i]!;
      if (!f.aviso || f.estado === "cargado") continue;
      poner(i, { estado: "cargando", detalle: undefined });
      try {
        const fotos: string[] = [];
        for (const e of f.fotos) fotos.push(await achicarFoto(new File([(await e.leer()) as BlobPart], e.nombre.split("/").pop() ?? "foto", { type: MIME[extDe(e.nombre)] })));
        await admin.crear({ ...f.aviso, fotos }, true);
        poner(i, { estado: "cargado" });
      } catch (e) {
        if (e instanceof ErrorApi && e.status === 401) { setError("Se cerró tu sesión. Entrá de nuevo y repetí la carga: los que ya entraron no se vuelven a cargar si no los tocás."); setCargando(false); return; }
        poner(i, { estado: "fallo", detalle: e instanceof ErrorApi ? (e.campos[0]?.msg ?? e.message) : e instanceof Error ? e.message : "Falló." });
      }
    }
    setCargando(false);
  }

  const listos = filas?.filter((f) => f.aviso && f.estado !== "cargado") ?? [];
  const cargados = filas?.filter((f) => f.estado === "cargado").length ?? 0;
  const terminado = !!filas && !cargando && cargados > 0 && listos.every((f) => f.estado === "fallo");

  return (
    <div className="lote">
      <h2>Cargar varios avisos</h2>
      <p className="small">Subí el <b>.zip</b> con las fichas y las fotos (o solo el archivo de fichas). Se revisa y, al confirmar, entran todos como <b>pendientes</b>: después los abrís, tocás Editar si hace falta y Aprobás.</p>
      {!cargando && !terminado && (
        <label className="btn btn-main lote-sel">
          {leyendo ? "Leyendo…" : filas ? "Elegir otro archivo" : "Elegir el .zip"}
          <input type="file" accept=".zip,.txt,.md,application/zip" disabled={leyendo} onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ""; if (a) void elegir(a); }} />
        </label>
      )}
      {error && <p className="form-err" role="alert">{error}</p>}
      {filas && (
        <>
          <p className="lote-res" role="status">
            <b>{listos.length + cargados}</b> {listos.length + cargados === 1 ? "aviso listo" : "avisos listos"}
            {filas.length - listos.length - cargados > 0 && <> · <b>{filas.length - listos.length - cargados}</b> con problemas (no se cargan hasta arreglarlos)</>}
            {cargados > 0 && <> · <b>{cargados}</b> ya cargados</>}
          </p>
          <ul className="admin-lista">
            {filas.map((f, i) => (
              <li key={f.num + i} className={`admin-item lote-fila ${f.estado}`}>
                <div className="admin-datos">
                  <p className="small"><b>#{f.num}</b> {f.aviso ? `${RUBROS[f.aviso.rubro].nombre} · ${f.aviso.tipo} · ${f.aviso.operacion} · ${f.aviso.pueblo}` : "No se puede cargar"}</p>
                  <h3>{f.aviso?.titulo || f.campos.titulo || "(sin título)"}</h3>
                  {f.aviso && <p className="small">{precioTexto({ ...f.aviso, id: 0 } as never)} · {f.fotos.length} {f.fotos.length === 1 ? "foto" : "fotos"}{f.fotosFaltan.length > 0 && <b className="err"> · no encontré: {f.fotosFaltan.join(", ")}</b>}</p>}
                  {f.errores.map((e) => <p key={e} className="err">✗ {e}</p>)}
                  {f.avisos.map((e) => <p key={e} className="small aviso-ojo">⚠ {e}</p>)}
                  {f.estado === "cargando" && <p className="small">Cargando…</p>}
                  {f.estado === "cargado" && <p className="small ok">✓ Cargado como pendiente</p>}
                  {f.estado === "fallo" && <p className="err">✗ No se cargó: {f.detalle}</p>}
                </div>
              </li>
            ))}
          </ul>
          {sobrantes.length > 0 && <details><summary className="small">{sobrantes.length} fotos del .zip no se asignaron a ningún aviso</summary><p className="small">{sobrantes.slice(0, 40).join(", ")}</p></details>}
          {!terminado && listos.length > 0 && (
            <button type="button" className="btn btn-main" disabled={cargando} onClick={() => void cargar()}>
              {cargando ? "Cargando… no cierres esta pantalla" : `Cargar ${listos.length} ${listos.length === 1 ? "aviso" : "avisos"} como pendientes`}
            </button>
          )}
          {cargados > 0 && !cargando && <button type="button" className="btn btn-line" onClick={onListo}>Ir a Pendientes</button>}
        </>
      )}
    </div>
  );
}
