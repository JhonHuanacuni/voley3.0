import { useEffect, useMemo, useRef, useState } from "react";

function detalle(opcion) {
  return [opcion.dni && `DNI ${opcion.dni}`, opcion.email, opcion.telefono].filter(Boolean).join(" · ");
}

export default function NombreBuscador({
  value,
  opciones = [],
  placeholder = "",
  disabled,
  onChange,
}) {
  const raiz = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(value || "");

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

  const consulta = texto.trim().toLowerCase();
  const visibles = useMemo(() => {
    if (!abierto || !consulta) return [];
    return opciones
      .filter((op) => [op.label, op.dni, op.email, op.telefono].filter(Boolean).join(" ").toLowerCase().includes(consulta))
      .slice(0, 8);
  }, [abierto, consulta, opciones]);

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
            <p>Sin coincidencias</p>
          )}
        </div>
      )}
    </div>
  );
}
