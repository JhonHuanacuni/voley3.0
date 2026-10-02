import { useEffect } from "react";
import { soles } from "../../../utils/boletaVenta";

const VACIA = { PRODUCTO: "", TALLA: "", PRECIO: "" };

function normalizar(value) {
  if (!Array.isArray(value) || value.length === 0) return [{ ...VACIA }];
  return value.map((linea) => ({
    PRODUCTO: linea?.PRODUCTO || "",
    TALLA: linea?.TALLA || "",
    PRECIO: linea?.PRECIO ?? "",
  }));
}

export default function LineasVenta({ value, productos = [], tallas = [], disabled, onChange }) {
  const lineas = normalizar(value);
  const total = lineas.reduce((suma, linea) => suma + (Number(linea.PRECIO) || 0), 0);

  useEffect(() => {
    if (!Array.isArray(value) || value.length === 0) onChange([{ ...VACIA }]);
  }, [value, onChange]);

  const actualizar = (indice, campo, valor) => {
    onChange(lineas.map((linea, i) => (i === indice ? { ...linea, [campo]: valor } : linea)));
  };

  return (
    <div className="lineas-venta">
      <datalist id="lineas-venta-productos">
        {productos.map((producto) => (
          <option key={producto} value={producto} />
        ))}
      </datalist>
      {lineas.map((linea, indice) => (
        <div className="lineas-venta-fila" key={indice}>
          <input
            type="text"
            list="lineas-venta-productos"
            aria-label={`Artículo ${indice + 1}`}
            placeholder="Artículo (escribe o elige)"
            maxLength={150}
            value={linea.PRODUCTO}
            disabled={disabled}
            onChange={(event) => actualizar(indice, "PRODUCTO", event.target.value)}
          />
          <select
            aria-label={`Talla ${indice + 1}`}
            value={linea.TALLA}
            disabled={disabled}
            onChange={(event) => actualizar(indice, "TALLA", event.target.value)}
          >
            <option value="" hidden>TALLA</option>
            {tallas.map((talla) => (
              <option key={talla} value={talla}>{talla}</option>
            ))}
          </select>
          <input
            aria-label={`Importe ${indice + 1}`}
            type="number"
            min="0"
            step="0.01"
            placeholder="Importe"
            value={linea.PRECIO}
            disabled={disabled}
            onChange={(event) => actualizar(indice, "PRECIO", event.target.value)}
          />
          {lineas.length > 1 && !disabled ? (
            <button type="button" className="btn-link" onClick={() => onChange(lineas.filter((_, i) => i !== indice))}>
              Quitar
            </button>
          ) : <span />}
        </div>
      ))}
      {!disabled && (
        <button type="button" className="btn-primary lineas-venta-agregar" onClick={() => onChange([...lineas, { ...VACIA }])}>
          Agregar artículo
        </button>
      )}
      <p className="lineas-venta-total">Total {soles(total)}</p>
    </div>
  );
}
