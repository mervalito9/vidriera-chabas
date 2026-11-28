// Cambios de estructura de la base que no se pueden hacer con un ALTER TABLE simple.
//
// SQLite no deja cambiar un CHECK: hay que armar la tabla de nuevo. Se hace como dice la documentación oficial
// (https://www.sqlite.org/lang_altertable.html, «Making Other Kinds Of Table Schema Changes»):
//   1. copia de respaldo de la base entera (VACUUM INTO), por si algo sale mal;
//   2. con las claves foráneas apagadas (para que borrar la tabla vieja NO borre las fotos ni los precios),
//      dentro de una transacción: tabla nueva, copiar todo, borrar la vieja, renombrar, volver a crear los índices;
//   3. controles: misma cantidad de filas, foreign_key_check vacío y la numeración de avisos intacta.
// Si cualquier control falla, se deshace todo y la base queda como estaba.
import type { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";

/** El CHECK viejo que solo aceptaba tres rubros. */
const CHECK_RUBRO = /rubro\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*rubro\s+IN\s*\([^)]*\)\s*\)/i;

/**
 * Saca el CHECK de `rubro` en la tabla avisos (los rubros los controla la aplicación). Así se pueden sumar rubros
 * nuevos, como Vacaciones, sin volver a migrar. Devuelve true si migró, false si no hacía falta.
 */
export function liberarRubro(db: DatabaseSync, respaldo: string): boolean {
  const fila = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'avisos'").get() as { sql?: string } | undefined;
  const sql = fila?.sql ?? "";
  if (!CHECK_RUBRO.test(sql)) return false;

  // 1. Respaldo completo y consistente (también con WAL).
  if (!existsSync(respaldo)) db.exec(`VACUUM INTO '${respaldo.replace(/'/g, "''")}'`);

  const contar = (t: string): number => Number((db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n);
  const antes = { avisos: contar("avisos"), fotos: contar("fotos"), precios: contar("precios") };
  const seq = Number((db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'avisos'").get() as { seq?: number } | undefined)?.seq ?? 0);
  const indices = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'avisos' AND sql IS NOT NULL").all() as { sql: string }[]).map((x) => x.sql);
  const nueva = sql.replace(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?["`]?avisos["`]?/i, "CREATE TABLE avisos_nueva").replace(CHECK_RUBRO, "rubro TEXT NOT NULL");
  if (nueva === sql || CHECK_RUBRO.test(nueva)) throw new Error("migración rubro: no pude armar la tabla nueva");

  // 2. Claves foráneas apagadas (se cambia fuera de la transacción, como pide SQLite).
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(nueva);
      db.exec("INSERT INTO avisos_nueva SELECT * FROM avisos");
      db.exec("DROP TABLE avisos");
      db.exec("ALTER TABLE avisos_nueva RENAME TO avisos");
      for (const i of indices) db.exec(i);
      // La numeración sigue donde estaba (no se reusan números de avisos borrados).
      db.prepare("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'avisos'").run(seq);
      // 3. Controles.
      const despues = { avisos: contar("avisos"), fotos: contar("fotos"), precios: contar("precios") };
      if (JSON.stringify(antes) !== JSON.stringify(despues)) throw new Error(`migración rubro: cambió la cantidad de filas ${JSON.stringify(antes)} → ${JSON.stringify(despues)}`);
      const rotas = db.prepare("PRAGMA foreign_key_check").all();
      if (rotas.length) throw new Error(`migración rubro: ${rotas.length} referencias rotas`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
  return true;
}
