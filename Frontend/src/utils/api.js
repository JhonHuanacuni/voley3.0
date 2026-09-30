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
