// La "foto" del sitio que recibe el asistente de Telegram para contestar preguntas. Va resumida (barata) y sin
// teléfonos: solo lo necesario para responder sobre gente, visitas, avisos, búsquedas y salud del servidor.
import * as actividad from "../actividad.ts";
import * as datos from "../db.ts";
import { dolar } from "../dolar.ts";
import * as estad from "../estad.ts";

const horaAR = (d = new Date()): string =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "full", timeStyle: "short" }).format(d);

export function fotoDelSitio(): unknown {
  const vivo = actividad.resumen("24h");
  const hoy = estad.resumen(1);
  const semana = estad.resumen(7);
  const mes = estad.resumen(30);
  const avisos = datos.listarAdmin("");
  const resumido = (a: (typeof avisos)[number]) => ({
    id: a.id, titulo: a.titulo, rubro: a.rubro, tipo: a.tipo, operacion: a.operacion, pueblo: a.pueblo,
    precio: a.precio === null ? "sin precio" : `${a.moneda} ${a.precio}`, fotos: a.fotos.length,
    publicadoEn: a.publicadoEn, venceEn: a.venceEn, reservado: a.reservado || undefined, destacado: a.destacado || undefined,
  });
  const errores = vivo.errores.filter((e) => !e.robot);
  return {
    ahora: horaAR(),
    enVivo: vivo.enVivo,
    hoy: { ...hoy.total, portada: hoy.portada },
    ultimos7dias: { total: semana.total, semanaAnterior: semana.anterior, porDia: semana.serie, avisosQueMasRinden: semana.avisos.slice(0, 5), deDondeVienen: semana.origenes.slice(0, 6), loQueBuscan: semana.busquedas.slice(0, 8), buscaronYNoEncontraron: semana.sinResultados.slice(0, 8), portada: semana.portada },
    ultimos30dias: { total: mes.total, mesAnterior: mes.anterior, avisosQueMasRinden: mes.avisos.slice(0, 10), rubros: mes.rubros, pueblos: mes.pueblos, deDondeVienen: mes.origenes.slice(0, 6) },
    medicionDesde: mes.desde,
    avisos: {
      cantidadPorEstado: avisos.filter((a) => !a.ejemplo).reduce<Record<string, number>>((c, a) => ({ ...c, [a.estado]: (c[a.estado] ?? 0) + 1 }), {}),
      pendientes: avisos.filter((a) => a.estado === "pendiente" && !a.ejemplo).map((a) => ({ ...resumido(a), llego: a.creadoEn, ordenadoPorElAsistente: a.mejora?.estado ?? "no", leFalta: a.mejora?.propuesta?.faltan.map((f) => f.que) })),
      publicados: avisos.filter((a) => a.estado === "publicado" && !a.ejemplo).map(resumido),
      vendidos: avisos.filter((a) => a.estado === "vendido" && !a.ejemplo).length,
    },
    busquedasDeVecinos: datos.listarBusquedas().slice(0, 15).map((b) => ({ rubro: b.rubro, que: b.titulo || b.que, presupuesto: b.presupuesto || undefined, fecha: b.creadoEn, seMuestraEnElSitio: !!b.publicaDesde })),
    servidorUltimas24h: { pedidos: vivo.total.pedidos, paginas: vivo.total.paginas, robots: vivo.total.robots, erroresDelVisitante: vivo.total.e4, erroresDelServidor: vivo.total.e5, lentos: vivo.total.lentos, ultimosErroresNoRobot: errores.slice(0, 5), salud: vivo.salud },
    dolarOficialDeReferencia: dolar(),
  };
}
