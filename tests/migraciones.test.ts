// La migración que saca el CHECK de rubro: no se pierde nada y es idempotente.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { liberarRubro } from "../server/migraciones.ts";

test("liberarRubro: base vieja → acepta rubros nuevos, sin perder avisos, fotos, precios ni numeración", () => {
  const dir = mkdtempSync(join(tmpdir(), "mig-"));
  const db = new DatabaseSync(join(dir, "v.db"));
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE avisos (id INTEGER PRIMARY KEY AUTOINCREMENT, estado TEXT NOT NULL DEFAULT 'pendiente', rubro TEXT NOT NULL CHECK (rubro IN ('inmuebles','vehiculos','agro')), titulo TEXT NOT NULL);
    CREATE INDEX avisos_rubro ON avisos (rubro);
    CREATE TABLE fotos (id INTEGER PRIMARY KEY AUTOINCREMENT, aviso_id INTEGER NOT NULL REFERENCES avisos(id) ON DELETE CASCADE, archivo TEXT NOT NULL);
    CREATE TABLE precios (id INTEGER PRIMARY KEY AUTOINCREMENT, aviso_id INTEGER NOT NULL REFERENCES avisos(id) ON DELETE CASCADE, precio INTEGER);
    ALTER TABLE avisos ADD COLUMN pueblo TEXT NOT NULL DEFAULT 'Chabás';
    INSERT INTO avisos (rubro, titulo) VALUES ('inmuebles','Casa'), ('vehiculos','Gol'), ('agro','Tractor');
    DELETE FROM avisos WHERE id = 3;
    INSERT INTO fotos (aviso_id, archivo) VALUES (1,'a.jpg'), (1,'b.jpg'), (2,'c.jpg');
    INSERT INTO precios (aviso_id, precio) VALUES (1, 100), (2, 200);`);
  assert.throws(() => db.exec("INSERT INTO avisos (rubro, titulo) VALUES ('vacaciones','x')"), /CHECK/);

  const respaldo = join(dir, "respaldo.db");
  assert.equal(liberarRubro(db, respaldo), true);
  assert.ok(existsSync(respaldo), "deja una copia de respaldo");
  const n = (t: string) => Number((db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n);
  assert.deepEqual([n("avisos"), n("fotos"), n("precios")], [2, 3, 2]);
  assert.equal((db.prepare("SELECT pueblo FROM avisos WHERE id = 1").get() as { pueblo: string }).pueblo, "Chabás", "las columnas agregadas siguen");
  assert.ok((db.prepare("SELECT name FROM sqlite_master WHERE name = 'avisos_rubro'").get()), "los índices siguen");
  db.exec("INSERT INTO avisos (rubro, titulo) VALUES ('vacaciones','Casa en Gesell')");
  assert.equal((db.prepare("SELECT MAX(id) AS m FROM avisos").get() as { m: number }).m, 4, "no reusa el número del aviso borrado");
  // Las fotos siguen atadas: borrar un aviso borra sus fotos.
  db.exec("DELETE FROM avisos WHERE id = 1");
  assert.equal(n("fotos"), 1);
  assert.equal(liberarRubro(db, respaldo), false, "la segunda vez no hace nada");
});
