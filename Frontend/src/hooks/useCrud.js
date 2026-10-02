import { useCallback, useEffect, useRef, useState } from "react";
import { parseJsonResponse } from "../utils/api";

export function useCrud({ entidad, pk = "ID", ordenInicial, filtrosIniciales = {} }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [tamanio, setTamanioState] = useState(10);
  const [buscar, setBuscar] = useState("");
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [orden, setOrden] = useState(
    ordenInicial || { campo: "", direccion: "ASC" },
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registro, setRegistro] = useState(null);
  const debounceRef = useRef(null);
  const [buscarInput, setBuscarInput] = useState("");

  const baseUrl = `/api/${entidad}`;

  const listar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        pagina: String(pagina),
        tamanio: String(tamanio),
      });
      if (orden.campo) {
        params.set("ordenarPor", orden.campo);
        params.set("direccion", orden.direccion);
      }
      if (buscar) params.set("buscar", buscar);
      Object.entries(filtros).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      const res = await fetch(`${baseUrl}/?${params}`);
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || "Error al listar");
      setItems(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || "Error al cargar datos");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, pagina, tamanio, buscar, filtros, orden, pk]);

  useEffect(() => {
    listar();
  }, [listar]);

  const onBuscarChange = (value) => {
    setBuscarInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBuscar(value);
      setPagina(1);
    }, 400);
  };

  const obtener = async (id) => {
    const res = await fetch(`${baseUrl}/${encodeURIComponent(id)}/`);
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "No se pudo obtener el registro");
    return data.data;
  };

  const actorId = () => localStorage.getItem("idusuario") || null;

  const writeHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    const actor = actorId();
    if (actor) headers["X-IdUsuario"] = actor;
    return headers;
  };

  const insertar = async (payload) => {
    const res = await fetch(`${baseUrl}/`, {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok || !data.ok) throw new Error(data.mensaje || data.error || "Error al crear");
    return data.mensaje;
  };

  const actualizar = async (id, payload) => {
    const res = await fetch(`${baseUrl}/${encodeURIComponent(id)}/`, {
      method: "PUT",
      headers: writeHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok || !data.ok) throw new Error(data.mensaje || data.error || "Error al actualizar");
    return data.mensaje;
  };

  const eliminar = async (id, params = {}) => {
    const merged = { ...params };
    if (actorId() && !merged.idusuario) merged.idusuario = actorId();
    const qs = new URLSearchParams(merged).toString();
    const url = qs
      ? `${baseUrl}/${encodeURIComponent(id)}/?${qs}`
      : `${baseUrl}/${encodeURIComponent(id)}/`;
    const res = await fetch(url, {
      method: "DELETE",
    });
    const data = await parseJsonResponse(res);
    if (!res.ok || !data.ok) throw new Error(data.mensaje || data.error || "Error al eliminar");
    return data.mensaje;
  };

  const toggleOrden = (campo) => {
    setOrden((prev) => ({
      campo,
      direccion: prev.campo === campo && prev.direccion === "ASC" ? "DESC" : "ASC",
    }));
    setPagina(1);
  };

  const setFiltro = (key, value) => {
    setFiltros((prev) => ({ ...prev, [key]: value }));
    setPagina(1);
  };

  const setTamanio = (valor) => {
    const numero = Number(valor);
    setTamanioState([10, 20, 30, 50].includes(numero) ? numero : 10);
    setPagina(1);
  };

  return {
    items,
    total,
    pagina,
    tamanio,
    buscar: buscarInput,
    filtros,
    orden,
    loading,
    error,
    registro,
    setRegistro,
    setPagina,
    setTamanio,
    onBuscarChange,
    setFiltro,
    toggleOrden,
    listar,
    obtener,
    insertar,
    actualizar,
    eliminar,
  };
}
