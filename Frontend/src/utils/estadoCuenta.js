const EVENTO = "academia:estado-cuenta";

export function abrirEstadoCuenta(idAlumna, pestana) {
  if (!idAlumna) return;
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { idAlumna, pestana } }));
}

export function alPedirEstadoCuenta(callback) {
  const manejador = (evento) => callback(evento.detail);
  window.addEventListener(EVENTO, manejador);
  return () => window.removeEventListener(EVENTO, manejador);
}
