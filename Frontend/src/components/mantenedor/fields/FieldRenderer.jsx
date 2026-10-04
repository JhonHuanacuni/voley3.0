import { useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faUpload } from "@fortawesome/free-solid-svg-icons";
import CatalogoBuscador from "./CatalogoBuscador";
import LineasVenta from "./LineasVenta";
import MensualidadAlumnaSelect from "./MensualidadAlumnaSelect";
import NombreBuscador from "./NombreBuscador";

const MAX_FOTO_BYTES = 5 * 1024 * 1024;

function placeholderSelect(etiqueta) {
  const limpia = String(etiqueta || "")
    .replace(/[¿?]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return limpia ? `SELECCIONAR ${limpia}` : "SELECCIONAR";
}

function opcionesDelCampo(campo, valores, value) {
  const base = campo.opcionesPor
    ? (campo.opcionesPor[valores?.[campo.dependeDe]] || [])
    : (campo.opciones || []);
  if (value && !base.includes(value)) return [value, ...base];
  return base;
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
  if (campo.control === "nota") {
    return <p className={`form-note ${campo.full ? "full" : ""}`}>{campo.texto}</p>;
  }
  const className = `form-field ${campo.full ? "full" : ""} ${error ? "has-error" : ""}`;

  const renderControl = () => {
    if (campo.control === "checklist") {
      const marcados = Array.isArray(value) ? value : [];
      const alternar = (codigo) => {
        onChange(marcados.includes(codigo) ? marcados.filter((c) => c !== codigo) : [...marcados, codigo]);
      };
      return (
        <div className="checklist">
          {!disabled && (
            <div className="checklist-acciones">
              <button type="button" className="btn-link" onClick={() => onChange(catalogo.map((op) => op.value))}>
                Marcar todo
              </button>
              <button type="button" className="btn-link" onClick={() => onChange([])}>
                Quitar todo
              </button>
            </div>
          )}
          <div className="checklist-grid">
            {catalogo.map((op) => (
              <label key={op.value} className={`checklist-item ${marcados.includes(op.value) ? "is-marcado" : ""}`}>
                <input
                  type="checkbox"
                  checked={marcados.includes(op.value)}
                  disabled={disabled}
                  onChange={() => alternar(op.value)}
                />
                <span>{op.label}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }
    if (campo.control === "lineasVenta") {
      return (
        <LineasVenta
          value={value}
          productos={campo.opciones || []}
          tallas={campo.tallas || []}
          disabled={disabled}
          onChange={onChange}
        />
      );
    }
    if (campo.control === "buscarNombre") {
      return (
        <NombreBuscador
          value={value}
          disabled={disabled}
          placeholder={campo.placeholder}
          onChange={onChange}
        />
      );
    }
    if (campo.control === "sugerido") {
      return (
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="" hidden>{placeholderSelect(campo.etiqueta)}</option>
          {opcionesDelCampo(campo, valores, value).map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      );
    }
    if (campo.control === "select" && campo.remoto === "alumnas") {
      return (
        <CatalogoBuscador
          value={value}
          disabled={disabled}
          placeholder="Escriba el nombre de la alumna..."
          onChange={onChange}
        />
      );
    }
    if (campo.control === "select" && campo.remoto === "mensualidades") {
      return (
        <MensualidadAlumnaSelect
          idalumna={valores?.[campo.filtraPor]}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      );
    }
    if (campo.control === "select" && campo.catalogo) {
      return (
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="" hidden={Boolean(campo.ocultarPlaceholder)}>
            {placeholderSelect(campo.etiqueta)}
          </option>
          {catalogo.map((op) => (
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
          {(!campo.obligatorio || campo.ocultarPlaceholder) && (
            <option value="" hidden={Boolean(campo.ocultarPlaceholder)}>
              {placeholderSelect(campo.etiqueta)}
            </option>
          )}
          {opcionesDelCampo(campo, valores, value).map((op) => (
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
          className="input-mayusculas"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
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
        className={campo.control === "text" || campo.control == null ? "input-mayusculas" : undefined}
        value={value}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            campo.control === "password" || campo.control === "date" || campo.control === "time" || campo.control === "number"
              ? e.target.value
              : e.target.value.toUpperCase()
          )
        }
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
