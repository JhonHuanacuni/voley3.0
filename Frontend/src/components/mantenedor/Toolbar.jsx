import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

export default function Toolbar({ buscar, onBuscarChange, filtros = [], placeholder = "Buscar..." }) {
  return (
    <div className="mantenedor-toolbar">
      <div className="mantenedor-search">
        <FontAwesomeIcon icon={faSearch} className="mantenedor-search-icon" />
        <input
          type="text"
          placeholder={placeholder}
          value={buscar}
          onChange={(e) => onBuscarChange(e.target.value)}
        />
      </div>
      {filtros.map((f) => (
        <select
          key={f.key}
          value={f.value || ""}
          onChange={(e) => f.onChange(e.target.value)}
          aria-label={f.etiqueta}
        >
          <option value="">
            {`SELECCIONAR ${String(f.etiqueta || "")
              .replace(/[¿?]/g, "")
              .replace(/\s+/g, " ")
              .trim()
              .toUpperCase()}`}
          </option>
          {f.opciones.map((op) => {
            const value = typeof op === "object" ? op.value : op;
            const label = typeof op === "object" ? op.label : op;
            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })}
        </select>
      ))}
    </div>
  );
}
