// Explicación de los errores que ve Felipe en Actividad.
/** Qué es cada error, en criollo, para no asustarse con los que no importan. */
export function explicarError(e: { estado: number; ruta: string; robot: boolean; metodo: string }): { texto: string; importa: boolean } {
  const r = e.ruta.toLowerCase();
  if (e.estado >= 500) return { texto: "Falla nuestra: mandame una captura", importa: true };
  if (/wp-|wordpress|\.php|\.env|\.git|\/admin\b(?!--)|phpmyadmin|xmlrpc|\.aws|config\.|backup|\.sql|cgi-bin|\/vendor\/|\.asp/.test(r))
    return { texto: "Robot buscando fallas de seguridad: no pasa nada", importa: false };
  if (/favicon|apple-touch-icon|browserconfig|manifest|\.well-known/.test(r)) return { texto: "Ícono o archivo que pide el celular o el navegador", importa: false };
  if (r.startsWith("/assets/")) return { texto: "Archivo de una versión anterior del sitio (alguien tenía la página abierta durante una actualización)", importa: false };
  if (r.startsWith("/fotos/")) return { texto: "Foto de un aviso que ya se borró", importa: false };
  if (/^\/api\/avisos\/\d+/.test(r) && e.estado === 404) return { texto: "Aviso que ya no está (vendido, vencido o borrado)", importa: false };
  if (e.estado === 429) return { texto: "Demasiados intentos seguidos: el sitio lo frenó", importa: false };
  if (e.estado === 401 || e.estado === 403) return { texto: "Sin permiso (alguien sin sesión del panel, o un robot)", importa: false };
  if (e.robot) return { texto: "Robot", importa: false };
  if (e.estado === 404) return { texto: "Dirección que no existe (mal escrita o vieja)", importa: false };
  return { texto: "Pedido mal armado", importa: false };
}
