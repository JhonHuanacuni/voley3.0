export const dbToInput = (s) =>
  s && s.length === 8 ? `${s.slice(4)}-${s.slice(2, 4)}-${s.slice(0, 2)}` : "";

export const inputToDb = (s) => (s ? s.split("-").reverse().join("") : null);

export const dbToView = (s) =>
  s && s.length === 8 ? `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}` : "";

const MESES_TEXTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** CHAR(8) DDMMYYYY a texto corto: 3 May 2026. */
export const dbToTexto = (s) => {
  const texto = String(s || "");
  if (texto.length !== 8) return "";
  const dia = Number(texto.slice(0, 2));
  const mes = Number(texto.slice(2, 4));
  const anio = texto.slice(4);
  if (!dia || mes < 1 || mes > 12) return "";
  return `${dia} ${MESES_TEXTO[mes - 1]} ${anio}`;
};

/** Clave ordenable YYYYMMDD desde CHAR(8) DDMMYYYY. */
export const dbToSortKey = (s) =>
  s && String(s).length === 8 ? `${String(s).slice(4)}${String(s).slice(2, 4)}${String(s).slice(0, 2)}` : "";

/** Primer y último día del mes de una fecha input (YYYY-MM-DD). */
export const rangoMesCompletoInput = (fechaInput) => {
  if (!fechaInput) return { desde: "", hasta: "" };
  const [y, m] = fechaInput.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    desde: `${y}-${mm}-01`,
    hasta: `${y}-${mm}-${String(ultimo).padStart(2, "0")}`,
  };
};

export const primerDiaMesInput = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
};

export const ultimoDiaMesInput = (fechaRef) => {
  const ref = fechaRef || primerDiaMesInput();
  return rangoMesCompletoInput(ref).hasta;
};

/** Hoy en formato input date (YYYY-MM-DD). */
export const hoyInput = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Suma días a una fecha input (YYYY-MM-DD). */
export const sumarDiasInput = (fechaInput, dias) => {
  if (!fechaInput || !dias) return "";
  const base = new Date(`${fechaInput}T12:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + Number(dias));
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Días hasta FECHAFIN (formato DB ddmmyyyy). Negativo si ya venció. */
export const diasRestantesDesdeDb = (fechaDb) => {
  if (!fechaDb || String(fechaDb).length !== 8) return null;
  const s = String(fechaDb);
  const fin = new Date(Number(s.slice(4)), Number(s.slice(2, 4)) - 1, Number(s.slice(0, 2)));
  if (Number.isNaN(fin.getTime())) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fin.setHours(0, 0, 0, 0);
  return Math.round((fin - hoy) / 86400000);
};

export const textoDiasRestantes = (dias) => {
  if (dias == null) return "—";
  if (dias < 0) return "Culminado";
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "1 día";
  return `${dias} días`;
};

export const claseDiasRestantes = (dias) => {
  if (dias == null) return "";
  if (dias < 0) return "dias-vence--vencida";
  if (dias <= 3) return "dias-vence--proxima";
  return "dias-vence--ok";
};
