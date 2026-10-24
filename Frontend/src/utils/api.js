export async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) {
    if (response.status === 502 || response.status === 503) {
      throw new Error("El backend no está disponible.");
    }
    throw new Error(`Respuesta vacía (HTTP ${response.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta inválida (HTTP ${response.status})`);
  }
}

/** Traduce errores de red del navegador a un mensaje usable en pantalla. */
export function mensajeErrorRed(err) {
  const msg = String(err?.message || err || "");
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)) {
    return "No se pudo confirmar la respuesta del servidor. Revisa tu internet y mira la lista antes de volver a guardar, por si el registro sí se guardó.";
  }
  return msg || "Error inesperado";
}
