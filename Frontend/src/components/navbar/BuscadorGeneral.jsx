import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faSpinner, faXmark } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { abrirEstadoCuenta } from "../../utils/estadoCuenta";

export default function BuscadorGeneral() {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(0);
  const contenedor = useRef(null);

  useEffect(() => {
    const limpio = texto.trim();
    if (limpio.length < 2) {
      setResultados([]);
      setCargando(false);
      return undefined;
    }
    let vigente = true;
    setCargando(true);
    const temporizador = setTimeout(async () => {
      try {
        const res = await fetch(`/api/buscar-alumnas/?q=${encodeURIComponent(limpio)}`);
        const data = await parseJsonResponse(res);
        if (vigente) {
          setResultados(res.ok ? data.data || [] : []);
          setActivo(0);
        }
      } catch {
        if (vigente) setResultados([]);
      } finally {
        if (vigente) setCargando(false);
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [texto]);

  useEffect(() => {
    const cerrar = (evento) => {
      if (contenedor.current && !contenedor.current.contains(evento.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const elegir = (alumna) => {
    abrirEstadoCuenta(alumna.IDALUMNA);
    setAbierto(false);
    setTexto("");
  };

  const alTeclear = (evento) => {
    if (!resultados.length) return;
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setActivo((i) => Math.min(i + 1, resultados.length - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      elegir(resultados[activo]);
    } else if (evento.key === "Escape") {
      setAbierto(false);
    }
  };

  const mostrarPanel = abierto && texto.trim().length >= 2;

  return (
    <div className="buscador-general" ref={contenedor}>
      <FontAwesomeIcon icon={cargando ? faSpinner : faMagnifyingGlass} spin={cargando} className="buscador-general-icono" />
      <input
        type="search"
        value={texto}
        placeholder="Buscar alumna: nombre, DNI, teléfono o código"
        aria-label="Buscar alumna"
        onChange={(e) => {
          setTexto(e.target.value);
          setCargando(e.target.value.trim().length >= 2);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTeclear}
      />
      {texto && (
        <button type="button" className="buscador-general-limpiar" aria-label="Limpiar búsqueda" onClick={() => setTexto("")}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}
      {mostrarPanel && (
        <ul className="buscador-general-panel" role="listbox">
          {!resultados.length && (
            <li className="buscador-general-vacio">{cargando ? "Buscando…" : "Sin coincidencias."}</li>
          )}
          {resultados.map((alumna, indice) => (
            <li key={alumna.IDALUMNA} role="option" aria-selected={indice === activo}>
              <button
                type="button"
                className={`buscador-general-item ${indice === activo ? "is-activo" : ""}`}
                onMouseEnter={() => setActivo(indice)}
                onClick={() => elegir(alumna)}
              >
                <strong>{alumna.NOMBRE}</strong>
                <span>
                  {alumna.IDALUMNA}
                  {alumna.DNI ? ` · DNI ${alumna.DNI}` : ""}
                  {alumna.TELAPODERADO || alumna.TELEFONO ? ` · ${alumna.TELAPODERADO || alumna.TELEFONO}` : ""}
                </span>
                <span className="buscador-general-meta">
                  {alumna.CICLO || "Sin categoría"}
                  <em className={`badge-estado ${alumna.ESTADO === "Activa" ? "activo" : "inactivo"}`}>{alumna.ESTADO}</em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
