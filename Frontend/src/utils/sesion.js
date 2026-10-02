const CLAVE_FUNCIONES = "funciones";
const EVENTO_FUNCIONES = "academia:funciones";

export function guardarFunciones(funciones) {
  localStorage.setItem(CLAVE_FUNCIONES, JSON.stringify(Array.isArray(funciones) ? funciones : []));
  window.dispatchEvent(new CustomEvent(EVENTO_FUNCIONES));
}

export function funcionesActuales() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_FUNCIONES) || "null");
    return Array.isArray(lista) ? lista : null;
  } catch {
    return null;
  }
}

/** true si el usuario tiene alguna de las funciones. Sin datos cargados no se bloquea: el backend valida igual. */
export function puede(...codigos) {
  const lista = funcionesActuales();
  if (!lista || !codigos.length) return true;
  return codigos.some((codigo) => lista.includes(codigo));
}

export function alCambiarFunciones(callback) {
  window.addEventListener(EVENTO_FUNCIONES, callback);
  return () => window.removeEventListener(EVENTO_FUNCIONES, callback);
}

export function limpiarFunciones() {
  localStorage.removeItem(CLAVE_FUNCIONES);
}

/** Toda llamada a /api lleva el usuario de la sesión para validar permisos y registrar la trazabilidad. */
export function instalarUsuarioEnPeticiones() {
  if (window.__usuarioEnPeticiones) return;
  window.__usuarioEnPeticiones = true;
  const original = window.fetch.bind(window);
  window.fetch = (entrada, opciones = {}) => {
    const url = typeof entrada === "string" ? entrada : entrada?.url || "";
    const usuario = localStorage.getItem("idusuario");
    if (!usuario || !url.startsWith("/api/")) return original(entrada, opciones);
    const headers = new Headers(opciones.headers || (typeof entrada === "string" ? undefined : entrada.headers));
    if (!headers.has("X-IdUsuario")) headers.set("X-IdUsuario", usuario);
    return original(entrada, { ...opciones, headers });
  };
}
