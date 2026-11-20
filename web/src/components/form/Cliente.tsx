// En el panel: de quién es el aviso. Los clientes que ya cargaste quedan guardados (salen de tus avisos)
// y se eligen de una lista, en vez de escribir nombre y WhatsApp cada vez.
import type { AvisoAdmin, Quien } from "../../../../shared/tipos.ts";
import { formatearTelefono } from "../../../../shared/whatsapp.ts";

export interface Cliente {
  nombre: string;
  telefono: string;
  anunciante: string;
  quien: Quien;
  avisos: number;
}

/** Un cliente por WhatsApp, con los datos de su aviso más nuevo; los que más publican, primero. */
export function clientesDe(avisos: AvisoAdmin[]): Cliente[] {
  const porTelefono = new Map<string, Cliente>();
  for (const a of [...avisos].sort((x, y) => y.creadoEn.localeCompare(x.creadoEn))) {
    if (!a.telefono) continue;
    const ya = porTelefono.get(a.telefono);
    if (ya) ya.avisos++;
    else porTelefono.set(a.telefono, { nombre: a.nombre, telefono: a.telefono, anunciante: a.anunciante, quien: a.quien, avisos: 1 });
  }
  return [...porTelefono.values()].sort((x, y) => y.avisos - x.avisos || (x.anunciante || x.nombre).localeCompare(y.anunciante || y.nombre));
}

export const QUIENES: [Exclude<Quien, "">, string][] = [["dueno", "Dueño"], ["inmobiliaria", "Inmobiliaria"], ["agencia", "Agencia"]];

/** Lo que se va a leer en el aviso como "Publica: …" (mismo criterio que el servidor). */
export function textoPublica(c: Pick<Cliente, "nombre" | "anunciante" | "quien">): string {
  if (c.anunciante && c.quien !== "dueno") return c.anunciante;
  return c.quien === "dueno" ? (c.nombre.trim().split(/\s+/)[0] ?? "") : c.anunciante;
}

export function ElegirCliente({ clientes, onElegir }: { clientes: Cliente[]; onElegir: (c: Cliente) => void }) {
  if (!clientes.length) return null;
  return (
    <div className="cliente-elegir">
      <label className="lbl" htmlFor="f-cliente">Cliente que ya cargaste <span className="opc">(completa todo solo)</span></label>
      <select id="f-cliente" value="" onChange={(e) => { const c = clientes[Number(e.target.value)]; if (c) onElegir(c); }}>
        <option value="">Elegir de la lista…</option>
        {clientes.map((c, i) => (
          <option key={c.telefono} value={i}>
            {c.anunciante && c.quien !== "dueno" ? `${c.anunciante} (${c.nombre})` : c.nombre} · {formatearTelefono(c.telefono)}{c.avisos > 1 ? ` · ${c.avisos} avisos` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
