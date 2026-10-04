import { useEffect, useRef, useState } from "react";
import { buscarAlumnasCombo } from "../../../utils/combos";

export default function CatalogoBuscador({
  value,
  placeholder = "Escriba para buscar...",
  disabled,
  onChange,
}) {
  const raiz = useRef(null);
  const pedidoActual = useRef(0);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [conocida, setConocida] = useState({ value: "", label: "" });
  const [valorPrevio, setValorPrevio] = useState(value);
  const [opciones, setOpciones] = useState([]);
  const [buscando, setBuscando] = useState(false);

  if (value !== valorPrevio) {
    setValorPrevio(value);
    if (!value) setTexto("");
  }

  const etiqueta = value && conocida.value === value ? conocida.label : "";

  useEffect(() => {
    if (!value || conocida.value === value) return undefined;
    let vigente = true;
    buscarAlumnasCombo({ id: value, limite: 1 })
      .then((lista) => {
        if (!vigente) return;
        const nombre = lista[0]?.label || "";
        setConocida({ value, label: nombre });
        setTexto(nombre);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [value, conocida.value]);

  useEffect(() => {
    const cerrar = (event) => {
      if (!raiz.current?.contains(event.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const consulta = texto.trim();
  const filtro = consulta === etiqueta ? "" : consulta;

  useEffect(() => {
    if (!abierto || disabled) return undefined;
    const espera = setTimeout(async () => {
      const pedido = ++pedidoActual.current;
      setBuscando(true);
      try {
        const lista = await buscarAlumnasCombo({ q: filtro });
        if (pedido === pedidoActual.current) setOpciones(lista);
      } catch {
        if (pedido === pedidoActual.current) setOpciones([]);
      } finally {
        if (pedido === pedidoActual.current) setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(espera);
  }, [abierto, filtro, disabled]);

  const elegir = (opcion) => {
    onChange(opcion.value);
    setConocida({ value: opcion.value, label: opcion.label });
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
          if (event.key === "Enter" && abierto && opciones[0]) {
            event.preventDefault();
            elegir(opciones[0]);
          }
          if (event.key === "Escape") setAbierto(false);
        }}
      />
      {abierto && !disabled && (
        <div className="catalogo-buscador-lista" role="listbox">
          {opciones.length ? opciones.map((op) => (
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
            <p>{buscando ? "Buscando..." : "Sin coincidencias"}</p>
          )}
        </div>
      )}
    </div>
  );
}
