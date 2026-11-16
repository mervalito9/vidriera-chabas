// Genera el valor de ADMIN_PASSWORD_HASH a partir de una contraseña.
// Uso: npm run clave   (te la pide y no queda guardada en ningún lado)
import { createInterface } from "node:readline/promises";
import { hashearClave } from "../server/auth.ts";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const clave = (await rl.question("Contraseña nueva para el panel (mínimo 12 caracteres): ")).trim();
rl.close();
if (clave.length < 12) {
  console.error("Muy corta: usá al menos 12 caracteres.");
  process.exit(1);
}
console.log("\nCopiá esta línea en tu archivo .env del servidor:\n");
console.log(`ADMIN_PASSWORD_HASH=${hashearClave(clave)}`);
