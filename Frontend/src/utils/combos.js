import { parseJsonResponse } from "./api";
import { dbToTexto } from "./fecha";

export async function buscarAlumnasCombo({ q = "", id = "", limite = 20 } = {}) {
  const params = new URLSearchParams({ limite: String(limite) });
  if (q) params.set("q", q);
  if (id) params.set("id", id);
  const res = await fetch(`/api/combo/alumnas/?${params}`);
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || "No se pudieron buscar las alumnas");
  return data.data || [];
}

export async function mensualidadesDeAlumna(idalumna) {
  if (!idalumna) return [];
  const res = await fetch(`/api/combo/mensualidades/?${new URLSearchParams({ idalumna })}`);
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || "No se pudieron cargar las mensualidades");
  return (data.data || []).map((item) => ({
    ...item,
    label: `${dbToTexto(item.inicio)} al ${dbToTexto(item.fin)} · ${item.estado}${
      item.saldo > 0 ? ` · saldo S/ ${Number(item.saldo).toFixed(2)}` : ""
    }`,
  }));
}
