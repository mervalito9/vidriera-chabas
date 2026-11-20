import { useState } from "react";
import { CENTRO_ZONA, COORDENADAS, PUEBLOS } from "../../../shared/config.ts";
import { slug } from "../../../shared/texto.ts";
import type { AvisoPublico } from "../../../shared/tipos.ts";
import { Tarjeta } from "../components/Tarjeta.tsx";
import { precioTexto } from "../formato.ts";
import { Mapa } from "./Mapa.tsx";

/** El pueblo que la persona eligió o escribió en el buscador ("casas en sanford" → Sanford). */
export function puebloBuscado(pueblo: string, texto: string): string | null {
  if (COORDENADAS[pueblo]) return pueblo;
  const t = slug(texto);
  return t ? (PUEBLOS.find((p) => t.split("-").includes(slug(p))) ?? null) : null;
}

/** Vista "Mapa" del listado: un globito con el precio por aviso; al tocarlo, aparece su tarjeta abajo. */
export function MapaListado({ avisos, pueblo, texto }: { avisos: AvisoPublico[]; pueblo: string; texto: string }) {
  const [elegido, setElegido] = useState<number | null>(null);
  const conLugar = avisos.filter((a) => a.lat !== null && a.lng !== null);
  const sinLugar = avisos.length - conLugar.length;
  const donde = puebloBuscado(pueblo, texto);
  // Con un pueblo: cerca, para ver las calles. Sin pueblo: toda la zona; se puede alejar o acercar a gusto.
  const [lat, lng] = donde ? COORDENADAS[donde]! : CENTRO_ZONA;
  const aviso = conLugar.find((a) => a.id === elegido) ?? null;

  return (
    <div className="mapa-listado">
      <Mapa lat={lat} lng={lng} zoom={donde ? 14 : 10} titulo={`Mapa de avisos${donde ? ` en ${donde}` : " de la zona"}`}
        puntos={conLugar.map((a) => ({ id: a.id, lat: a.lat!, lng: a.lng!, etiqueta: a.precio ? precioTexto(a) : "Consultar", elegido: a.id === elegido }))}
        onTocarPunto={(id) => setElegido(Number(id))} onTocarMapa={() => setElegido(null)} />
      {aviso && <div className="mapa-elegido"><Tarjeta aviso={aviso} /></div>}
      <p className="small mapa-nota">
        {conLugar.length === 0 ? "Ninguno de estos avisos tiene la ubicación marcada todavía." : "Tocá un precio para ver el aviso. Alejá el mapa para ver los otros pueblos."}
        {sinLugar > 0 && conLugar.length > 0 && ` ${sinLugar === 1 ? "1 aviso no tiene" : `${sinLugar} avisos no tienen`} la ubicación marcada: está en la lista.`}
      </p>
    </div>
  );
}
