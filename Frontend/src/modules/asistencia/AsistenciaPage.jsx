import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { hoyInput, inputToDb } from "../../utils/fecha";
import "../../styles/mantenedor.css";
import "./asistencia.css";

const ESTADOS = [
  { id: "Presente", tono: "presente" },
  { id: "Ausente", tono: "ausente" },
  { id: "Tarde", tono: "tarde" },
];

const COLUMNAS = [
  { campo: "NOMBRE", etiqueta: "Alumna" },
  { campo: "TURNO", etiqueta: "Turno" },
  { campo: "ESTADO", etiqueta: "Estado" },
];

function valorOrden(fila, campo) {
  if (campo === "ESTADO") return fila.ESTADO || "Sin marcar";
  return String(fila[campo] || "");
}

export default function AsistenciaPage() {
  const [fecha, setFecha] = useState(hoyInput());
  const [turno, setTurno] = useState(null);
  const [buscar, setBuscar] = useState("");
  const [turnos, setTurnos] = useState([]);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);
  const [orden, setOrden] = useState({ campo: "NOMBRE", direccion: "ASC" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/catalogos/");
        const data = await parseJsonResponse(res);
        const lista = res.ok ? (data.data?.turnos || []) : [];
        setTurnos(lista);
        setTurno(lista[0]?.value || "");
      } catch {
        setError("No se pudieron cargar los turnos.");
      }
    })();
  }, []);

  const consulta = buscar.trim();
  const busquedaSp = consulta.length >= 3 ? consulta : "";
  const [busquedaAplicada, setBusquedaAplicada] = useState("");

  useEffect(() => {
    const espera = setTimeout(() => setBusquedaAplicada(busquedaSp), 350);
    return () => clearTimeout(espera);
  }, [busquedaSp]);

  const pedidoActual = useRef(0);

  const cargar = async (fechaValor, turnoValor, buscarValor) => {
    const fechaDb = inputToDb(fechaValor);
    if (!fechaDb) return;
    const pedido = ++pedidoActual.current;
    setCargando(true);
    setError("");
    const params = new URLSearchParams({ fecha: fechaDb });
    if (turnoValor) params.set("idturno", turnoValor);
    if (buscarValor) params.set("buscar", buscarValor);
    try {
      const res = await fetch(`/api/asistencia/dia/?${params}`);
      const data = await parseJsonResponse(res);
      if (pedido !== pedidoActual.current) return;
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la asistencia");
      setFilas(data.data || []);
    } catch (err) {
      if (pedido !== pedidoActual.current) return;
      setError(err.message);
      setFilas([]);
    } finally {
      if (pedido === pedidoActual.current) setCargando(false);
    }
  };

  useEffect(() => {
    if (turno === null) return;
    cargar(fecha, turno, busquedaAplicada);
  }, [fecha, turno, busquedaAplicada]);

  const marcar = async (idalumna, estado) => {
    setAviso("");
    try {
      const res = await fetch("/api/asistencia/marcar/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ IDALUMNA: idalumna, FECHA: inputToDb(fecha), ESTADO: estado }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data.mensaje || data.error || "No se pudo marcar");
      setFilas((prev) => prev.map((fila) => (
        fila.IDALUMNA === idalumna ? { ...fila, ESTADO: estado } : fila
      )));
    } catch (err) {
      setAviso(err.message);
    }
  };

  const visibles = useMemo(() => (
    [...filas].sort((a, b) => {
      const cmp = valorOrden(a, orden.campo).localeCompare(valorOrden(b, orden.campo), "es", { sensitivity: "base" });
      return orden.direccion === "ASC" ? cmp : -cmp;
    })
  ), [filas, orden]);

  const toggleOrden = (campo) => {
    setOrden((prev) => ({
      campo,
      direccion: prev.campo === campo && prev.direccion === "ASC" ? "DESC" : "ASC",
    }));
  };

  return (
    <div className="mantenedor-page">
      <section className="asistencia-panel">
        <div className="asistencia-filtros">
          <label className="asistencia-buscar">
            Buscar alumna
            <span>
              <FontAwesomeIcon icon={faSearch} />
              <input
                type="search"
                value={buscar}
                onChange={(event) => setBuscar(event.target.value)}
                placeholder="Escriba al menos 3 letras del nombre..."
              />
            </span>
          </label>
          <label>
            Fecha
            <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
          </label>
          <label className="asistencia-turno">
            Turno
            <select value={turno || ""} onChange={(event) => setTurno(event.target.value)}>
              {turnos.map((item) => (
                <option key={item.value} value={item.value}>{String(item.label || "").toUpperCase()}</option>
              ))}
              <option value="">TODOS</option>
            </select>
          </label>
        </div>
      </section>

      {error && <p className="field-error">{error}</p>}
      {aviso && <p className="field-error">{aviso}</p>}
      {consulta.length > 0 && consulta.length < 3 && (
        <p className="asistencia-ayuda">Escribe al menos 3 letras para filtrar por nombre.</p>
      )}

      <div className="mantenedor-card asistencia-tabla">
        <table className="data-table">
          <thead>
            <tr>
              {COLUMNAS.map((col) => (
                <th key={col.campo} className="sortable" onClick={() => toggleOrden(col.campo)}>
                  {col.etiqueta}{" "}
                  <FontAwesomeIcon
                    icon={orden.campo !== col.campo ? faSort : orden.direccion === "ASC" ? faSortUp : faSortDown}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={3}>Cargando asistencia...</td></tr>
            )}
            {!cargando && visibles.map((fila) => (
              <tr key={fila.IDALUMNA}>
                <td className="asistencia-nombre">{fila.NOMBRE}</td>
                <td>{fila.TURNO || "—"}</td>
                <td>
                  <div className="asistencia-acciones">
                    {ESTADOS.map((estado) => (
                      <button
                        key={estado.id}
                        type="button"
                        className={`asistencia-estado asistencia-estado--${estado.tono}${fila.ESTADO === estado.id ? " is-active" : ""}`}
                        onClick={() => marcar(fila.IDALUMNA, estado.id)}
                      >
                        {estado.id}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {!cargando && !visibles.length && (
              <tr><td colSpan={3}>No hay alumnas para este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
