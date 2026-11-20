// Mapa propio, sin librerías: cuadraditos (tiles) de OpenStreetMap, arrastrar, acercar y alejar (botones, rueda,
// doble toque o pellizco) y puntos encima. Es el mismo mapa de todo el mundo: se puede alejar hasta ver la zona,
// la provincia o el país.
// Reglas de uso de OpenStreetMap: dar crédito visible y mandar "Referer" (el sitio lo apaga en general;
// cada imagen del mapa lo vuelve a prender con referrerPolicy).
import { useEffect, useRef, useState, type PointerEvent as EventoPuntero, type ReactNode, type WheelEvent as EventoRueda } from "react";

const TAM = 256;
const MIN_ZOOM = 5;
const MAX_ZOOM = 18;

export interface Punto {
  id: number | string;
  lat: number;
  lng: number;
  /** Texto del globito (ej. "USD 68.000"). Sin texto: un pin. */
  etiqueta?: string;
  elegido?: boolean;
}

interface Props {
  lat: number;
  lng: number;
  zoom: number;
  puntos?: Punto[];
  onTocarPunto?: (id: Punto["id"]) => void;
  /** Toque en el mapa (no en un punto): para marcar una ubicación. */
  onTocarMapa?: (lat: number, lng: number) => void;
  /** Etiqueta para lectores de pantalla */
  titulo: string;
  className?: string;
  children?: ReactNode;
}

// Proyección de Mercator: grados ↔ píxeles del mundo a un zoom dado.
const aMundo = (lat: number, lng: number, z: number) => {
  const n = TAM * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
};
const aGrados = (x: number, y: number, z: number) => {
  const n = TAM * 2 ** z;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lat, lng };
};
const limitar = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function Mapa({ lat, lng, zoom, puntos = [], onTocarPunto, onTocarMapa, titulo, className = "", children }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  // Centro en píxeles del mundo y zoom actual. Cambian al arrastrar o acercar.
  const [vista, setVista] = useState(() => ({ ...aMundo(lat, lng, zoom), z: zoom }));
  // Si desde afuera cambian el centro (otro pueblo, otro aviso), el mapa va ahí.
  useEffect(() => setVista({ ...aMundo(lat, lng, zoom), z: zoom }), [lat, lng, zoom]);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Acercar o alejar dejando quieto el punto de la pantalla (px, py) que está bajo el dedo o el mouse.
  const acercar = (dz: number, px = tam.w / 2, py = tam.h / 2) =>
    setVista((v) => {
      const z = limitar(v.z + dz);
      if (z === v.z) return v;
      const f = 2 ** (z - v.z);
      const mx = v.x - tam.w / 2 + px;
      const my = v.y - tam.h / 2 + py;
      return { x: mx * f - px + tam.w / 2, y: my * f - py + tam.h / 2, z };
    });

  // ---- arrastrar, pellizcar y tocar (punteros: dedo o mouse) ----
  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef({ movio: false, distancia: 0, ultimoToque: 0 });
  const local = (e: { clientX: number; clientY: number }) => {
    const r = caja.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const abajo = (e: EventoPuntero) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.current.size === 1) gesto.current.movio = false;
    if (dedos.current.size === 2) {
      const [a, b] = [...dedos.current.values()];
      gesto.current.distancia = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    }
  };
  const mover = (e: EventoPuntero) => {
    const antes = dedos.current.get(e.pointerId);
    if (!antes) return;
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.current.size === 2) {
      const [a, b] = [...dedos.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const g = gesto.current;
      if (g.distancia && (d / g.distancia > 1.35 || d / g.distancia < 0.74)) {
        const medio = local({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 });
        acercar(d > g.distancia ? 1 : -1, medio.x, medio.y);
        g.distancia = d;
      }
      g.movio = true;
      return;
    }
    const dx = e.clientX - antes.x, dy = e.clientY - antes.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) gesto.current.movio = true;
    setVista((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
  };
  const arriba = (e: EventoPuntero) => {
    const eraUnDedo = dedos.current.size === 1;
    dedos.current.delete(e.pointerId);
    if (!eraUnDedo || gesto.current.movio) return;
    const ahora = performance.now();
    const p = local(e);
    if (ahora - gesto.current.ultimoToque < 300) {
      gesto.current.ultimoToque = 0;
      acercar(1, p.x, p.y);
      return;
    }
    gesto.current.ultimoToque = ahora;
    if (onTocarMapa) {
      const g = aGrados(vista.x - tam.w / 2 + p.x, vista.y - tam.h / 2 + p.y, vista.z);
      onTocarMapa(g.lat, g.lng);
    }
  };
  const rueda = (e: EventoRueda) => {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 4) return;
    const p = local(e);
    acercar(e.deltaY < 0 ? 1 : -1, p.x, p.y);
  };

  // ---- cuadraditos visibles ----
  const n = 2 ** vista.z;
  const x0 = vista.x - tam.w / 2, y0 = vista.y - tam.h / 2;
  const tiles: { k: string; src: string; left: number; top: number }[] = [];
  if (tam.w) {
    for (let ty = Math.floor(y0 / TAM); ty <= Math.floor((y0 + tam.h) / TAM); ty++) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = Math.floor(x0 / TAM); tx <= Math.floor((x0 + tam.w) / TAM); tx++) {
        const x = ((tx % n) + n) % n;
        tiles.push({ k: `${vista.z}/${tx}/${ty}`, src: `https://tile.openstreetmap.org/${vista.z}/${x}/${ty}.png`, left: tx * TAM - x0, top: ty * TAM - y0 });
      }
    }
  }

  return (
    <div className={`mapa ${className}`} ref={caja} role="application" aria-label={titulo}
      onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerCancel={(e) => dedos.current.delete(e.pointerId)} onWheel={rueda}>
      {tiles.map((t) => (
        <img key={t.k} className="mapa-tile" src={t.src} alt="" width={TAM} height={TAM} draggable={false} referrerPolicy="strict-origin-when-cross-origin"
          style={{ transform: `translate(${Math.round(t.left)}px, ${Math.round(t.top)}px)` }} />
      ))}
      {puntos.map((p) => {
        const m = aMundo(p.lat, p.lng, vista.z);
        const left = m.x - x0, top = m.y - y0;
        if (left < -80 || top < -40 || left > tam.w + 80 || top > tam.h + 40) return null;
        return (
          <button key={p.id} type="button" className={`mapa-punto${p.etiqueta ? " con-texto" : ""}${p.elegido ? " elegido" : ""}`}
            style={{ transform: `translate(${Math.round(left)}px, ${Math.round(top)}px) translate(-50%, -100%)` }}
            aria-label={p.etiqueta ?? "Ubicación"} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
            onClick={() => onTocarPunto?.(p.id)}>
            {p.etiqueta && <span>{p.etiqueta}</span>}
          </button>
        );
      })}
      <div className="mapa-zoom" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Acercar" disabled={vista.z >= MAX_ZOOM} onClick={() => acercar(1)}>+</button>
        <button type="button" aria-label="Alejar" disabled={vista.z <= MIN_ZOOM} onClick={() => acercar(-1)}>−</button>
      </div>
      <a className="mapa-credito" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
        onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>© OpenStreetMap</a>
      {children}
    </div>
  );
}
