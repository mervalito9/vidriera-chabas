# Vidriera Chabás

Avisos de casas, vehículos y maquinaria agro de Chabás. Web en **React + TypeScript**, backend en **Node.js 24 + TypeScript** y base de datos **SQLite**, todo en un solo servidor.

## Cómo está armado

```
shared/   Tipos, configuración, validación y textos que usan la web y el backend
server/   API, base de datos, fotos, sesión del panel (Node 24 corre TypeScript directo)
web/      La web en React: src/ (código), public/ (estilos, fuentes, imágenes), index.html
scripts/  build.mjs (arma la web con esbuild) y clave.ts (genera la contraseña del panel)
tests/    Pruebas del backend de punta a punta (npm test)
```

- **Una sola página de aviso** (`web/src/pages/Aviso.tsx`): se llena con lo que devuelve `GET /api/avisos/:id`. No hay una página por publicación.
- **Rutas**: `#inicio`, `#buscar`, `#inmuebles`, `#vehiculos--moto`, `#aviso--12`, `#publicar--agro`, `#busco`, `#admin`.
- **Link para compartir**: `https://tudominio/a/12` muestra la foto y el título del aviso en la vista previa de WhatsApp y lleva al aviso.

### La API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/avisos?rubro=&tipo=&op=&q=&max=&moneda=&permuta=1&financia=1&orden=&limite=&desde=` | Lista los avisos vigentes (sin teléfonos) |
| GET | `/api/avisos/:id` | Un aviso (suma una visita) |
| POST | `/api/avisos/:id/contacto` | Devuelve el link de WhatsApp del dueño (el teléfono solo sale por acá) |
| POST | `/api/publicaciones` | Un vecino publica: queda **pendiente** hasta que lo aprobás |
| POST | `/api/busquedas` | "Avisame cuando aparezca" |
| POST | `/api/admin/login` · `/api/admin/logout` | Entrar y salir del panel |
| GET/POST | `/api/admin/avisos` | Ver todos / cargar un aviso ya publicado |
| PATCH/DELETE | `/api/admin/avisos/:id` | Aprobar, rechazar, marcar vendido, renovar, cambiar precio, borrar |
| GET/DELETE | `/api/admin/busquedas` | Ver y borrar búsquedas |

Cada cambio de precio queda guardado en la tabla `precios`: es la base del **historial de precios** (la web ya muestra "Bajó de precio").

## Probarlo en tu compu

Necesitás **Node.js 24** o más nuevo.

```bash
npm install
npm run build          # arma la web en web/dist
npm run ejemplos       # carga los 13 avisos de ejemplo (solo si la base está vacía)
npm run clave          # te pide una contraseña y te da el ADMIN_PASSWORD_HASH
ADMIN_PASSWORD_HASH='scrypt:...' npm start
```

Abrí http://localhost:3000 · El panel está en http://localhost:3000/#admin

Otros comandos: `npm test` (pruebas del backend), `npm run typecheck` (revisa los tipos), `npm run dev` (rearma la web y reinicia el servidor solo al guardar).

## Publicarlo en internet (servidor propio, unos US$5–6 por mes)

1. **Comprá el dominio** (por ejemplo en NIC Argentina, `.com.ar`).
2. **Contratá un servidor** Linux chico (VPS) con Ubuntu: Hetzner, DigitalOcean, Vultr o uno argentino. Con 1 GB de RAM alcanza.
3. En el panel del dominio, apuntá el dominio a la IP del servidor (registro **A**).
4. Entrá al servidor, instalá Docker (`curl -fsSL https://get.docker.com | sh`) y subí esta carpeta (sin `node_modules`).
5. Copiá `.env.example` como `.env` y completalo (`DOMINIO`, `SITE_URL` y `ADMIN_PASSWORD_HASH`).
6. Levantalo: `docker compose up -d --build`. Caddy saca el certificado **HTTPS** solo.
7. (Opcional) Cargá los ejemplos: `docker compose exec vidriera node server/seed.ts`.

**Cuidados con el servidor:**
- Entrá con **llave SSH**, no con contraseña. Activá la **verificación en dos pasos** en la cuenta del proveedor y del dominio.
- Abrí solo los puertos 22, 80 y 443 (`ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable`).
- Activá las actualizaciones automáticas de seguridad (`unattended-upgrades`).
- **Backups**: todo (base y fotos) está en el volumen `datos`. Copia diaria con:
  `docker run --rm -v vidriera_datos:/d -v $PWD:/b alpine tar czf /b/backup-$(date +%F).tgz -C /d .`
  y guardala fuera del servidor.

## Configuración

- **WhatsApp del sitio**: `WA_NUMERO` en `shared/config.ts` (después, `npm run build`).
- **Pueblos "Próximamente"**, **rubros** y **atajos**: también en `shared/config.ts`.
- **Lanzar** (aparecer en Google): `NOINDEX=0` en `.env` y sacar `noindex` de `web/index.html`.

## Seguridad (resumen)

- La web no carga nada de otros sitios. Hay una CSP estricta, y las cabeceras `nosniff`, `DENY`, `no-referrer` y `Permissions-Policy`.
- Todo se valida en el servidor con la misma lógica que en la web (`shared/validar.ts`), con límites de largo.
- Las fotos se controlan por sus primeros bytes (solo JPG, PNG o WebP), se guardan con un nombre al azar y no se puede salir de las carpetas públicas.
- La contraseña del panel se guarda con scrypt. La sesión va en una cookie `HttpOnly` + `SameSite=Strict` y el token se guarda hasheado.
- Hay límite de pedidos por IP en login, publicar, búsquedas y contacto. Los pedidos que cambian datos exigen una cabecera propia (anti-CSRF).
- React escapa todo el texto: no se usa `innerHTML` ni `eval`.

## Vista previa sin servidor

`npm run build -- --vista-previa` arma `web/dist-vista-previa`: la misma web con los avisos de ejemplo, y publicar por WhatsApp. Es la que se ve en el link de Claude.

> Términos y Privacidad son borradores: que los revise un abogado antes de lanzar.
