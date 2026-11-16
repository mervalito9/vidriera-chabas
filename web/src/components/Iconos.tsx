import type { RubroId } from "../../../shared/tipos.ts";

const base = { fill: "none", strokeWidth: 2.6, strokeLinejoin: "round", strokeLinecap: "round", "aria-hidden": true } as const;

export function IconoRubro({ rubro, color = "#F2ECDF" }: { rubro: RubroId; color?: string }) {
  if (rubro === "inmuebles")
    return (
      <svg viewBox="0 0 32 32" stroke={color} {...base}>
        <path d="M4.5 15 16 5.5 27.5 15" />
        <path d="M8 12.5V26h16V12.5" />
        <path d="M13.5 26v-7h5v7" />
      </svg>
    );
  if (rubro === "vehiculos")
    return (
      <svg viewBox="0 0 32 32" stroke={color} {...base}>
        <path d="M3.5 21.5v-5l3.5-1.2L10.5 9h11l4 6.3 3 1.2v5" />
        <path d="M14 21.5h4" />
        <circle cx="9.5" cy="21.8" r="3" />
        <circle cx="22.5" cy="21.8" r="3" />
      </svg>
    );
  return (
    <svg viewBox="0 0 32 32" stroke={color} {...base}>
      <circle cx="10" cy="21" r="6" />
      <circle cx="25" cy="23.5" r="3.5" />
      <path d="M6 15.5V7h8.5l2.5 8" />
      <path d="M17 15h9v6" />
      <path d="M14.5 7v8" />
    </svg>
  );
}

export const IconoBuscar = () => (
  <svg className="ico" viewBox="0 0 24 24" stroke="currentColor" {...base}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </svg>
);

export const IconoMas = () => (
  <svg className="ico" viewBox="0 0 24 24" stroke="currentColor" {...base} strokeWidth={2.8}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
