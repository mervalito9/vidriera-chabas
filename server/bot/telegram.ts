// Cliente mínimo de la API de Telegram, sin dependencias (usa el fetch de Node).
// El token vive solo en una variable de entorno y nunca se escribe en los registros.

export interface FotoTelegram {
  file_id: string;
  file_size?: number;
  width: number;
  height: number;
}

export interface MensajeTelegram {
  message_id: number;
  from?: { id: number; is_bot?: boolean };
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  photo?: FotoTelegram[];
  document?: { file_id: string; mime_type?: string; file_size?: number };
}

export interface UpdateTelegram {
  update_id: number;
  message?: MensajeTelegram;
}

export interface TelegramApi {
  /** Pide mensajes nuevos y espera hasta `segundos` si no hay (long polling). */
  getUpdates(offset: number, segundos: number): Promise<UpdateTelegram[]>;
  sendMessage(chatId: number, texto: string): Promise<void>;
  /** Baja un archivo de Telegram. Falla si pesa más de `maxBytes`. */
  descargar(fileId: string, maxBytes: number): Promise<Buffer>;
}

const MAX_TEXTO = 4000; // Telegram acepta hasta 4096 caracteres por mensaje

export function crearTelegram(token: string, f: typeof fetch = fetch): TelegramApi {
  const base = `https://api.telegram.org/bot${token}`;

  async function llamar<T>(metodo: string, cuerpo: Record<string, unknown>, esperaMs = 15_000): Promise<T> {
    // Los errores nombran el método, nunca la URL: la URL lleva el token.
    let r: Response;
    try {
      r = await f(`${base}/${metodo}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(esperaMs),
      });
    } catch {
      throw new Error(`Telegram ${metodo}: no hubo respuesta`);
    }
    if (!r.ok) throw new Error(`Telegram ${metodo}: error ${r.status}`);
    const j = (await r.json()) as { ok?: boolean; result?: T };
    if (!j.ok || j.result === undefined) throw new Error(`Telegram ${metodo}: respuesta inválida`);
    return j.result;
  }

  return {
    getUpdates: (offset, segundos) => llamar<UpdateTelegram[]>("getUpdates", { offset, timeout: segundos, allowed_updates: ["message"] }, (segundos + 15) * 1000),

    async sendMessage(chatId, texto) {
      for (let i = 0; i < texto.length || i === 0; i += MAX_TEXTO) {
        await llamar("sendMessage", { chat_id: chatId, text: texto.slice(i, i + MAX_TEXTO), disable_web_page_preview: true });
      }
    },

    async descargar(fileId, maxBytes) {
      const info = await llamar<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
      if (!info.file_path) throw new Error("Telegram getFile: sin ruta");
      if (info.file_size !== undefined && info.file_size > maxBytes) throw new Error("archivo demasiado pesado");
      let r: Response;
      try {
        r = await f(`https://api.telegram.org/file/bot${token}/${info.file_path}`, { signal: AbortSignal.timeout(30_000) });
      } catch {
        throw new Error("Telegram descarga: no hubo respuesta");
      }
      if (!r.ok) throw new Error(`Telegram descarga: error ${r.status}`);
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length > maxBytes) throw new Error("archivo demasiado pesado");
      return b;
    },
  };
}
