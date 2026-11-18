/** Se muestra en lugar de un botón de WhatsApp si WA_NUMERO quedó vacío. */
export function FaltaWhatsApp() {
  return <p className="falta-wa" role="status">Falta configurar el WhatsApp del sitio. Probá de nuevo más tarde.</p>;
}
