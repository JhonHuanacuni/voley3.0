import { useEffect, useRef, useState } from "react";
import { buscarAlumnasCombo } from "../../../utils/combos";

function detalle(opcion) {
  return [opcion.dni && `DNI ${opcion.dni}`, opcion.email, opcion.telefono].filter(Boolean).join(" · ");
}

export default function NombreBuscador({
  value,
  placeholder = "",
  disabled,
  onChange,
}) {
  const raiz = useRef(null);
  const pedidoActual = useRef(0);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(value || "");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    setTexto(value || "");
  }, [value]);

  useEffect(() => {
    const cerrar = (event) => {
      if (!raiz.current?.contains(event.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const consulta = texto.trim();
  const activo = abierto && Boolean(consulta) && !disabled;
  const visibles = activo ? resultados : [];

  useEffect(() => {
    if (!activo) return undefined;
    const espera = setTimeout(async () => {
      const pedido = ++pedidoActual.current;
      setBuscando(true);
      try {
        const lista = await buscarAlumnasCombo({ q: consulta, limite: 8 });
        if (pedido === pedidoActual.current) setResultados(lista);
      } catch {
        if (pedido === pedidoActual.current) setResultados([]);
      } finally {
        if (pedido === pedidoActual.current) setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(espera);
  }, [activo, consulta]);

  const elegir = (opcion) => {
    const nombre = String(opcion.label || "").toUpperCase();
    onChange(nombre);
    setTexto(nombre);
    setAbierto(false);
  };

  return (
    <div className="nombre-buscador" ref={raiz}>
      <input
        type="search"
        className="input-mayusculas"
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setAbierto(true)}
        onChange={(event) => {
          const siguiente = event.target.value.toUpperCase();
          setTexto(siguiente);
          setAbierto(true);
          onChange(siguiente);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && abierto && visibles[0]) {
            event.preventDefault();
            elegir(visibles[0]);
          }
          if (event.key === "Escape") setAbierto(false);
        }}
      />
      {abierto && !disabled && consulta && (
        <div className="nombre-buscador-lista" role="listbox">
          {visibles.length ? visibles.map((op) => (
            <button
              key={op.value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => elegir(op)}
            >
              <span>{op.label}</span>
              {detalle(op) && <small>{detalle(op)}</small>}
            </button>
          )) : (
            <p>{buscando ? "Buscando..." : "Sin coincidencias"}</p>
          )}
        </div>
      )}
    </div>
  );
}
