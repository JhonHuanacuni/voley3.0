/** Días de asistencia por plan (bitmask: lun=1, mar=2, mié=4, jue=8, vie=16, sáb=32, dom=64). */
export const DIAS_SEMANA_PLAN = [
  { weekday: 0, bit: 1, corto: "Lun", label: "Lunes" },
  { weekday: 1, bit: 2, corto: "Mar", label: "Martes" },
  { weekday: 2, bit: 4, corto: "Mié", label: "Miércoles" },
  { weekday: 3, bit: 8, corto: "Jue", label: "Jueves" },
  { weekday: 4, bit: 16, corto: "Vie", label: "Viernes" },
  { weekday: 5, bit: 32, corto: "Sáb", label: "Sábado" },
  { weekday: 6, bit: 64, corto: "Dom", label: "Domingo" },
];

export const DEFAULT_DIAS_ASISTENCIA = 63; // lun–sáb

export function parseDiasAsistencia(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DIAS_ASISTENCIA;
  return n & 0x7f;
}

export function diaPermitidoPlan(fechaDb, diasAsistencia) {
  const mask = parseDiasAsistencia(diasAsistencia);
  if (!fechaDb || String(fechaDb).length !== 8) return false;
  const s = String(fechaDb);
  const d = new Date(Number(s.slice(4)), Number(s.slice(2, 4)) - 1, Number(s.slice(0, 2)));
  const jsDay = d.getDay();
  const weekday = jsDay === 0 ? 6 : jsDay - 1;
  return Boolean(mask & (1 << weekday));
}

export function resumenDiasAsistencia(val) {
  const mask = parseDiasAsistencia(val);
  const activos = DIAS_SEMANA_PLAN.filter((d) => mask & d.bit).map((d) => d.corto);
  if (!activos.length) return "—";
  if (activos.length === 7) return "L–D";
  if (activos.length === 6 && !(mask & 64)) return `${activos.join(" ")}`;
  return activos.join(" ");
}

export function toggleDiaAsistencia(mask, bit, checked) {
  const base = parseDiasAsistencia(mask);
  return checked ? base | bit : base & ~bit;
}
