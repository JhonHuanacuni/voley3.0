import { useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faUpload } from "@fortawesome/free-solid-svg-icons";
import CatalogoBuscador from "./CatalogoBuscador";

const MAX_FOTO_BYTES = 5 * 1024 * 1024;

function placeholderSelect(etiqueta) {
  const limpia = String(etiqueta || "")
    .replace(/[¿?]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return limpia ? `SELECCIONAR ${limpia}` : "SELECCIONAR";
}

export default function FieldRenderer({
  campo,
  value,
  error,
  disabled,
  catalogo = [],
  valores = {},
  onChange,
}) {
  const fileRef = useRef(null);
  const className = `form-field ${campo.full ? "full" : ""} ${error ? "has-error" : ""}`;

  const renderControl = () => {
    if (campo.control === "select" && campo.catalogo) {
      const referencia = campo.filtraPor ? valores?.[campo.filtraPor] : null;
      const opciones = campo.filtraPor
        ? (referencia ? catalogo.filter((op) => op.idalumna === referencia) : [])
        : catalogo;
      if (campo.buscar) {
        return (
          <CatalogoBuscador
            value={value}
            opciones={opciones}
            disabled={disabled}
            placeholder="Escriba el nombre de la alumna..."
            onChange={onChange}
          />
        );
      }
      return (
        <select value={value} disabled={disabled || (campo.filtraPor && !referencia)} onChange={(e) => onChange(e.target.value)}>
          <option value="">{campo.filtraPor && !referencia ? "SELECCIONA UNA ALUMNA" : placeholderSelect(campo.etiqueta)}</option>
          {opciones.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      );
    }
    if (campo.control === "select") {
      return (
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {!campo.obligatorio && <option value="">{placeholderSelect(campo.etiqueta)}</option>}
          {(campo.opciones || []).map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      );
    }
    if (campo.control === "textarea") {
      return (
        <textarea
          rows={campo.rows || 3}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    if (campo.control === "image") {
      const previewSrc = value
        ? value.startsWith("data:")
          ? value
          : `data:image/jpeg;base64,${value}`
        : null;

      const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FOTO_BYTES) {
          onChange("");
          alert("La imagen no debe superar 5 MB.");
          e.target.value = "";
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          onChange(base64);
        };
        reader.readAsDataURL(file);
      };

      return (
        <div className="image-field">
          {previewSrc && (
            <img src={previewSrc} alt="Vista previa" className="image-field-preview" />
          )}
          <div
            className={`image-file-drop${value ? " image-file-drop--loaded" : ""}${disabled ? " is-disabled" : ""}`}
            onClick={() => !disabled && fileRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && !disabled && fileRef.current?.click()}
            role="button"
            tabIndex={disabled ? -1 : 0}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={disabled}
              onChange={handleFile}
              className="image-file-input"
            />
            <FontAwesomeIcon
              icon={value ? faImage : faUpload}
              className="image-file-drop-icon"
            />
            {value ? (
              <>
                <strong>Foto seleccionada</strong>
                <span>Clic para cambiar · Máximo 5 MB</span>
              </>
            ) : (
              <>
                <strong>SELECCIONAR FOTO</strong>
                <span>JPG, PNG o WEBP · Máximo 5 MB</span>
              </>
            )}
          </div>
          {value && !disabled && (
            <button type="button" className="btn-link" onClick={() => onChange("")}>
              Quitar foto
            </button>
          )}
        </div>
      );
    }
    return (
      <input
        type={
          campo.control === "password"
            ? "password"
            : campo.control === "date"
              ? "date"
              : campo.control === "time"
                ? "time"
                : campo.control === "number"
                  ? "number"
                  : "text"
        }
        step={campo.control === "number" ? (campo.step ?? "0.01") : undefined}
        min={campo.control === "number" ? (campo.min ?? "0") : undefined}
        max={campo.control === "number" ? campo.max : undefined}
        className={campo.mayusculas ? "input-mayusculas" : undefined}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(campo.mayusculas ? e.target.value.toUpperCase() : e.target.value)}
      />
    );
  };

  return (
    <div className={className}>
      <label htmlFor={campo.campo}>{campo.etiqueta}</label>
      {renderControl()}
      {error && <span className="field-error">{error}</span>}
      {campo.ayuda && <span className="field-hint">{campo.ayuda}</span>}
    </div>
  );
}
