import { useEffect, useRef, useState } from "react";
import { parseJsonResponse } from "../../utils/api";

export default function EstudianteSearchField({
  value,
  disabled,
  error,
  onChange,
  estudianteSeleccionado,
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResultados([]);
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const params = new URLSearchParams({ buscar: query.trim() });
        const res = await fetch(`/api/mensualidades/estudiantes/?${params}`);
        const data = await parseJsonResponse(res);
        if (res.ok) {
          setResultados(data.data || []);
          setAbierto(true);
        }
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const seleccionar = (est) => {
    onChange(est.IDUSUARIO, est);
    setQuery("");
    setResultados([]);
    setAbierto(false);
  };

  const limpiar = () => {
    onChange("", null);
    setQuery("");
    setResultados([]);
  };

  const nombre =
    estudianteSeleccionado?.NOMBRE_COMPLETO ||
    estudianteSeleccionado?.ESTUDIANTE_NOMBRE ||
    "";
  const dni =
    estudianteSeleccionado?.DNI || estudianteSeleccionado?.ESTUDIANTE_DNI || "";

  return (
    <div className={`estudiante-search ${error ? "has-error" : ""}`} ref={wrapRef}>
      {value && nombre ? (
        <div className="estudiante-seleccionado">
          <div>
            <strong>{nombre}</strong>
            {dni && <span className="estudiante-dni">DNI: {dni}</span>}
          </div>
          {!disabled && (
            <button type="button" className="btn-link" onClick={limpiar}>
              Cambiar
            </button>
          )}
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Buscar por nombre completo o DNI..."
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => resultados.length > 0 && setAbierto(true)}
          />
          {buscando && <span className="field-hint">Buscando...</span>}
          {abierto && resultados.length > 0 && (
            <ul className="estudiante-resultados">
              {resultados.map((est) => (
                <li key={est.IDUSUARIO}>
                  <button type="button" onClick={() => seleccionar(est)}>
                    <span>{est.NOMBRE_COMPLETO}</span>
                    <small>DNI {est.DNI}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {abierto && !buscando && query && resultados.length === 0 && (
            <p className="field-hint">Sin resultados.</p>
          )}
        </>
      )}
    </div>
  );
}
