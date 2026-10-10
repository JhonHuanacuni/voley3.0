import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import FieldRenderer from "./fields/FieldRenderer";
import DiasSemanaField from "./fields/DiasSemanaField";
import EstudianteSearchField from "../../modules/mensualidad/EstudianteSearchField";
import { DEFAULT_DIAS_ASISTENCIA } from "../../utils/diasPlan";
import { dbToInput, inputToDb, hoyInput } from "../../utils/fecha";

const emptyValues = (campos) =>
  campos.reduce((acc, c) => {
      if (c.defaultHoy && c.control === "date") {
      acc[c.campo] = hoyInput();
    } else if (c.control === "diasSemana") {
      acc[c.campo] = c.defaultValue ?? DEFAULT_DIAS_ASISTENCIA;
    } else {
      acc[c.campo] = c.defaultValue ?? "";
    }
    return acc;
  }, {});

function filtrarCampo(campo, modo) {
  if (campo.autoCodigo) return false;
  if (modo === "crear" && campo.soloEditar) return false;
  if (modo !== "crear" && campo.soloCrear) return false;
  if (modo === "ver" && campo.campo === "CONTRA") return false;
  /* Solo ocultar ID de usuario (texto) al editar — no el buscador de estudiante */
  if (modo === "editar" && campo.campo === "IDUSUARIO" && campo.control === "text") return false;
  return true;
}

function visibleParaTipo(item, values) {
  if (!item.soloTiposUsuario?.length) return true;
  return item.soloTiposUsuario.map(String).includes(String(values.IDTIPOUSUARIO ?? ""));
}

function campoVisibleEnFormulario(campo, values, secciones) {
  if (!visibleParaTipo(campo, values)) return false;
  if (!secciones?.length) return true;
  const seccion = secciones.find((s) => (s.campos || []).some((c) => c.campo === campo.campo));
  if (seccion && !visibleParaTipo(seccion, values)) return false;
  return true;
}

export default function FormModal({
  abierto,
  modo,
  titulo,
  campos,
  secciones,
  registro,
  catalogos = {},
  estudianteSeleccionado,
  onEstudianteChange,
  onFieldChange,
  onClose,
  onSubmit,
  compacto = false,
}) {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const soloLectura = modo === "ver";

  const todosLosCampos = useMemo(
    () => (secciones ? secciones.flatMap((s) => s.campos) : campos || []),
    [secciones, campos],
  );

  useEffect(() => {
    if (!abierto) return;
    if (modo === "crear") {
      setValues(emptyValues(todosLosCampos));
    } else if (registro) {
      const next = { ...registro };
      todosLosCampos.forEach((c) => {
        if (c.control === "date" && next[c.campo]) {
          next[c.campo] = dbToInput(String(next[c.campo]));
        }
        if (c.campo === "ESTADOMIEMBRO" && next[c.campo] != null) {
          next[c.campo] = String(next[c.campo]);
        }
        if (c.control === "diasSemana") {
          next[c.campo] = Number(next[c.campo]) || DEFAULT_DIAS_ASISTENCIA;
        }
        if (c.control === "time" && next[c.campo]) {
          next[c.campo] = String(next[c.campo]).slice(0, 5);
        }
        if (c.control === "number" && next[c.campo] != null && next[c.campo] !== "") {
          next[c.campo] = Number(next[c.campo]);
        }
        if (c.mayusculas && next[c.campo] != null) {
          next[c.campo] = String(next[c.campo]).toUpperCase();
        }
      });
      setValues(next);
    }
    setErrors({});
  }, [abierto, modo, registro, todosLosCampos]);

  if (!abierto) return null;

  const validate = () => {
    const next = {};
    const camposValidar = todosLosCampos.filter(
      (c) => filtrarCampo(c, modo) && campoVisibleEnFormulario(c, values, secciones),
    );
    camposValidar.forEach((c) => {
      if (soloLectura) return;
      if (c.obligatorio && modo === "crear" && !String(values[c.campo] ?? "").trim()) {
        next[c.campo] = `Ingresa ${c.etiqueta.toLowerCase()}.`;
      }
      if (c.control === "estudiante" && modo !== "ver" && !String(values[c.campo] ?? "").trim()) {
        next[c.campo] = "Selecciona un estudiante.";
      }
      if (
        c.obligatorio &&
        modo === "editar" &&
        c.campo !== "CONTRA" &&
        !String(values[c.campo] ?? "").trim()
      ) {
        next[c.campo] = `Ingresa ${c.etiqueta.toLowerCase()}.`;
      }
      if (c.control === "diasTexto" && c.obligatorio && modo !== "ver" && !String(values[c.campo] ?? "").trim()) {
        next[c.campo] = "Marca al menos un día.";
      }
      if (c.validacion === "email" && String(values[c.campo] ?? "").trim()) {
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values[c.campo]).trim());
        if (!ok) next[c.campo] = "Ingresa un email válido.";
      }
      if (c.control === "diasSemana" && modo !== "ver") {
        const mask = Number(values[c.campo]) || 0;
        if (!mask) next[c.campo] = "Selecciona al menos un día de asistencia.";
      }
      if (c.validacion === "dni" && values[c.campo]) {
        const ok = /^\d{8}$/.test(String(values[c.campo]).trim());
        if (!ok) next[c.campo] = "El DNI debe tener 8 dígitos.";
      }
    });
    const campoContra = todosLosCampos.find((c) => c.campo === "CONTRA");
    if (
      modo === "crear" &&
      campoContra?.obligatorio &&
      !String(values.CONTRA ?? "").trim()
    ) {
      next.CONTRA = "Ingresa la contraseña.";
    }
    if (Object.keys(next).length > 0) {
      next._form = "Completa los campos obligatorios marcados en rojo.";
    }
    setErrors(next);
    return Object.keys(next).filter((k) => k !== "_form").length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (soloLectura) return onClose();
    if (enviandoRef.current || !validate()) return;

    const payload = { ...values };
    todosLosCampos.forEach((c) => {
      if (!campoVisibleEnFormulario(c, values, secciones)) {
        delete payload[c.campo];
        return;
      }
      if (c.control === "date") {
        payload[c.campo] = inputToDb(values[c.campo]) || null;
      }
      if (c.mayusculas && payload[c.campo] != null) {
        payload[c.campo] = String(payload[c.campo]).toUpperCase();
      }
    });
    if (modo === "editar" && !payload.CONTRA) delete payload.CONTRA;

    enviandoRef.current = true;
    try {
      setEnviando(true);
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setErrors({ _form: err.message });
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const renderCampo = (campo) => {
    if (campo.control === "estudiante") {
      return (
        <div key={campo.campo} className={`form-field full ${errors[campo.campo] ? "has-error" : ""}`}>
          <label htmlFor={campo.campo}>{campo.etiqueta}</label>
          <EstudianteSearchField
            value={values[campo.campo] ?? ""}
            disabled={soloLectura || modo === "editar"}
            error={errors[campo.campo]}
            estudianteSeleccionado={estudianteSeleccionado}
            onChange={(id, est) => {
              setValues((prev) => ({ ...prev, [campo.campo]: id }));
              onEstudianteChange?.(est);
            }}
          />
          {campo.ayuda && <span className="field-hint">{campo.ayuda}</span>}
          {errors[campo.campo] && <span className="field-error">{errors[campo.campo]}</span>}
        </div>
      );
    }

    if (campo.control === "diasSemana") {
      return (
        <div key={campo.campo} className={`form-field full ${errors[campo.campo] ? "has-error" : ""}`}>
          <label htmlFor={campo.campo}>{campo.etiqueta}</label>
          <DiasSemanaField
            value={values[campo.campo] ?? DEFAULT_DIAS_ASISTENCIA}
            disabled={soloLectura}
            error={errors[campo.campo]}
            onChange={(val) => setValues((prev) => ({ ...prev, [campo.campo]: val }))}
          />
          {campo.ayuda && <span className="field-hint">{campo.ayuda}</span>}
        </div>
      );
    }

    return (
      <FieldRenderer
        key={campo.campo}
        campo={campo}
        value={values[campo.campo] ?? ""}
        error={errors[campo.campo]}
        disabled={soloLectura || (campo.soloCrear && modo === "editar") || campo.bloqueado}
        catalogo={catalogos[campo.catalogo]}
        valores={values}
        onChange={(val) => {
          setValues((prev) => {
            const next = { ...prev, [campo.campo]: val };
            (campo.limpia || []).forEach((clave) => {
              next[clave] = "";
            });
            return next;
          });
          onFieldChange?.(campo.campo, val, setValues);
        }}
      />
    );
  };

  const bloques = secciones
    ? secciones
        .filter((sec) => visibleParaTipo(sec, values))
        .map((sec) => ({
          titulo: sec.titulo,
          campos: sec.campos.filter(
            (c) => filtrarCampo(c, modo) && campoVisibleEnFormulario(c, values, secciones),
          ),
        }))
        .filter((sec) => sec.campos.length > 0)
    : [{ titulo: null, campos: (campos || []).filter((c) => filtrarCampo(c, modo)) }];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-panel modal-panel--form ${secciones ? "modal-panel--wide" : ""} ${compacto ? "modal-panel--compact" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h2 id="modal-title">{titulo}</h2>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors._form && <p className="field-error form-error-banner">{errors._form}</p>}
            {bloques.map((bloque) => (
              <section key={bloque.titulo || "default"} className="form-section">
                {bloque.titulo && <h3 className="form-section-title">{bloque.titulo}</h3>}
                <div className="form-grid">
                  {bloque.campos.map(renderCampo)}
                </div>
              </section>
            ))}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {soloLectura ? "Cerrar" : "Cancelar"}
            </button>
            {!soloLectura && (
              <button type="submit" className="btn-primary" disabled={enviando}>
                {enviando && <FontAwesomeIcon icon={faSpinner} spin />}
                Guardar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
