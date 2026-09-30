import { useEffect, useMemo, useRef, useState } from "react";

export default function CatalogoBuscador({
  value,
  opciones = [],
  placeholder = "Escriba para buscar...",
  disabled,
  onChange,
}) {
  const raiz = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");

  const seleccionado = opciones.find((op) => op.value === value);

  useEffect(() => {
    setTexto(seleccionado?.label || "");
  }, [seleccionado?.label, value]);

  useEffect(() => {
    const cerrar = (event) => {
      if (!raiz.current?.contains(event.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const consulta = texto.trim().toLowerCase();
  const visibles = useMemo(() => {
    if (!abierto) return [];
    if (!consulta || consulta === String(seleccionado?.label || "").toLowerCase()) return opciones;
    return opciones.filter((op) => String(op.label || "").toLowerCase().includes(consulta));
  }, [abierto, consulta, opciones, seleccionado?.label]);

  const elegir = (opcion) => {
    onChange(opcion.value);
    setTexto(opcion.label);
    setAbierto(false);
  };

  return (
    <div className="catalogo-buscador" ref={raiz}>
      <input
        type="search"
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setAbierto(true)}
        onChange={(event) => {
          const siguiente = event.target.value;
          setTexto(siguiente);
          setAbierto(true);
          if (!siguiente.trim()) onChange("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && abierto && visibles[0]) {
            event.preventDefault();
            elegir(visibles[0]);
          }
          if (event.key === "Escape") setAbierto(false);
        }}
      />
      {abierto && !disabled && (
        <div className="catalogo-buscador-lista" role="listbox">
          {visibles.length ? visibles.map((op) => (
            <button
              key={op.value}
              type="button"
              className={op.value === value ? "is-active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => elegir(op)}
            >
              {op.label}
            </button>
          )) : (
            <p>Sin coincidencias</p>
          )}
        </div>
      )}
    </div>
  );
}
