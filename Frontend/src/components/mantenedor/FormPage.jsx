import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faKey, faSpinner } from "@fortawesome/free-solid-svg-icons";
import FieldRenderer from "./fields/FieldRenderer";
import PageHeader from "./PageHeader";
import EstudianteSearchField from "../../modules/mensualidad/EstudianteSearchField";
import { dbToInput, inputToDb, hoyInput } from "../../utils/fecha";

const emptyValues = (campos) =>
  campos.reduce((acc, c) => {
    if (c.soloFrontend && c.control === "action") return acc;
    if (c.defaultHoy && c.control === "date") {
      acc[c.campo] = hoyInput();
    } else {
      acc[c.campo] = c.defaultValue ?? "";
    }
    return acc;
  }, {});

function filtrarCampo(campo, modo) {
  if (campo.autoCodigo) return false;
  if (campo.control === "action" && modo !== "crear") return false;
  if (modo === "crear" && campo.soloEditar) return false;
  if (modo !== "crear" && campo.soloCrear) return false;
  if (modo === "ver" && (campo.campo === "CONTRA" || campo.campo === "CONFIRMAR_CONTRA")) return false;
  if (modo === "editar" && campo.campo === "IDUSUARIO" && campo.control === "text") return false;
  return true;
}

function visibleParaTipo(item, values) {
  if (!item.soloTiposUsuario?.length) return true;
  return item.soloTiposUsuario.map(String).includes(String(values.IDTIPOUSUARIO ?? ""));
}

function campoVisibleEnFormulario(campo, values, secciones) {
  if (campo.visibleSi) {
    const actual = String(values?.[campo.visibleSi.campo] ?? "");
    if (campo.visibleSi.lleno ? !actual.trim() : actual !== String(campo.visibleSi.valor)) return false;
  }
  if (!visibleParaTipo(campo, values)) return false;
  if (!secciones?.length) return true;
  const seccion = secciones.find((s) => (s.campos || []).some((c) => c.campo === campo.campo));
  if (seccion && !visibleParaTipo(seccion, values)) return false;
  return true;
}

function esCampoPersistente(campo) {
  return !campo.soloFrontend && campo.control !== "action" && !campo.bloqueado;
}

function aplicarCredencialesAuto(payload, modo) {
  if (modo !== "crear") return payload;
  const dni = String(payload.DNI ?? "").trim();
  if (dni && !String(payload.IDUSUARIO ?? "").trim()) payload.IDUSUARIO = dni;
  if (dni && !String(payload.CONTRA ?? "").trim()) payload.CONTRA = dni;
  return payload;
}

const EMPTY_CREATE_DEFAULTS = Object.freeze({});

export default function FormPage({
  modo,
  modulo,
  listado,
  vista,
  titulo,
  campos,
  secciones,
  registro,
  catalogos = {},
  estudianteSeleccionado,
  onEstudianteChange,
  onFieldChange,
  onCancel,
  onSubmit,
  createDefaults,
  pie,
}) {
  const mergedCreateDefaults = createDefaults ?? EMPTY_CREATE_DEFAULTS;
  const createDefaultsKey =
    modo === "crear" ? JSON.stringify(mergedCreateDefaults) : "";
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [enviando, setEnviando] = useState(false);
  const soloLectura = modo === "ver";

  const todosLosCampos = useMemo(
    () => (secciones ? secciones.flatMap((s) => s.campos) : campos || []),
    [secciones, campos],
  );

  useEffect(() => {
    if (modo === "crear") {
      setValues({ ...emptyValues(todosLosCampos), ...mergedCreateDefaults });
    } else if (registro) {
      const next = { ...registro };
      todosLosCampos.forEach((c) => {
        if (c.control === "date" && next[c.campo]) {
          next[c.campo] = dbToInput(String(next[c.campo]));
        }
        if (c.campo === "ESTADOMIEMBRO" && next[c.campo] != null) {
          next[c.campo] = String(next[c.campo]);
        }
      });
      setValues(next);
    }
    setErrors({});
  }, [modo, registro, todosLosCampos, createDefaultsKey]);

  const generarDesdeDni = () => {
    const dni = String(values.DNI ?? "").trim();
    if (!/^\d{8}$/.test(dni)) {
      setErrors((prev) => ({
        ...prev,
        DNI: "Ingresa un DNI válido (8 dígitos) antes de generar.",
        _form: "Completa el DNI en Datos personales para generar credenciales.",
      }));
      return;
    }
    setValues((prev) => ({
      ...prev,
      IDUSUARIO: dni,
      CONTRA: dni,
      CONFIRMAR_CONTRA: dni,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.DNI;
      delete next.IDUSUARIO;
      delete next.CONTRA;
      delete next.CONFIRMAR_CONTRA;
      delete next._form;
      return next;
    });
  };

  const validate = () => {
    const next = {};
    const camposValidar = todosLosCampos.filter(
      (c) => filtrarCampo(c, modo) && campoVisibleEnFormulario(c, values, secciones) && c.control !== "action",
    );
    camposValidar.forEach((c) => {
      if (soloLectura) return;
      if (c.obligatorio && modo === "crear" && !String(values[c.campo] ?? "").trim()) {
        next[c.campo] = `Ingresa ${c.etiqueta.toLowerCase()}.`;
      }
      if (c.control === "estudiante" && modo !== "ver" && !String(values[c.campo] ?? "").trim()) {
        next[c.campo] = "Selecciona un estudiante.";
      }
      if (c.control === "lineasVenta" && modo !== "ver") {
        const lineas = Array.isArray(values[c.campo]) ? values[c.campo] : [];
        const incompleta = lineas.length === 0 || lineas.some((linea) => {
          const precio = String(linea?.PRECIO ?? "").trim();
          return !String(linea?.PRODUCTO || "").trim() || precio === "" || Number(precio) < 0 || Number.isNaN(Number(precio));
        });
        if (incompleta) next[c.campo] = "Selecciona cada artículo e ingresa su importe.";
      }
      if (
        c.obligatorio &&
        modo === "editar" &&
        c.campo !== "CONTRA" &&
        c.campo !== "CONFIRMAR_CONTRA" &&
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
      if (c.validacion === "dni" && values[c.campo]) {
        const ok = /^\d{8}$/.test(String(values[c.campo]).trim());
        if (!ok) next[c.campo] = "El DNI debe tener 8 dígitos.";
      }
    });

    const contraIngresada = String(values.CONTRA ?? "").trim();
    if (modo === "crear" && contraIngresada) {
      const confirm = String(values.CONFIRMAR_CONTRA ?? "").trim();
      if (!confirm) {
        next.CONFIRMAR_CONTRA = "Confirma la contraseña.";
      } else if (contraIngresada !== confirm) {
        next.CONFIRMAR_CONTRA = "Las contraseñas no coinciden.";
      }
    }

    if (Object.keys(next).length > 0) {
      const visibles = new Set(camposValidar.map((c) => c.campo));
      const ocultos = Object.keys(next).filter((k) => !visibles.has(k)).map((k) => next[k]);
      next._form = ocultos.length
        ? ocultos.join(" ")
        : "Completa los campos obligatorios marcados en rojo.";
    }
    setErrors(next);
    return Object.keys(next).filter((k) => k !== "_form").length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (soloLectura) return onCancel();
    if (!validate()) return;

    const payload = {};
    todosLosCampos.forEach((c) => {
      if (!esCampoPersistente(c) || !campoVisibleEnFormulario(c, values, secciones)) return;
      if (c.control === "date") {
        payload[c.campo] = inputToDb(values[c.campo]) || null;
      } else {
        payload[c.campo] = values[c.campo];
      }
    });
    if (modo === "editar" && !payload.CONTRA) delete payload.CONTRA;
    aplicarCredencialesAuto(payload, modo);

    try {
      setEnviando(true);
      await onSubmit(payload);
    } catch (err) {
      setErrors({ _form: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const renderCampo = (campo) => {
    if (campo.control === "action" && campo.accion === "generarDesdeDni") {
      return (
        <div key={campo.campo} className="form-field form-field--action">
          <label>{campo.etiqueta}</label>
          <button
            type="button"
            className="btn-secondary btn-generar-contra"
            onClick={generarDesdeDni}
            disabled={soloLectura}
          >
            <FontAwesomeIcon icon={faKey} />
            Generar credenciales
          </button>
          {campo.ayuda && <span className="field-hint">{campo.ayuda}</span>}
        </div>
      );
    }

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
          grupo: sec.grupo || null,
          campos: sec.campos.filter(
            (c) => filtrarCampo(c, modo) && campoVisibleEnFormulario(c, values, secciones),
          ),
        }))
        .filter((sec) => sec.campos.length > 0)
    : [{ titulo: null, grupo: null, campos: (campos || []).filter((c) => filtrarCampo(c, modo) && campoVisibleEnFormulario(c, values, secciones)) }];

  const filas = [];
  bloques.forEach((bloque) => {
    if (bloque.grupo) {
      const ultima = filas[filas.length - 1];
      if (ultima?.tipo === "grupo" && ultima.grupo === bloque.grupo) {
        ultima.secciones.push(bloque);
      } else {
        filas.push({ tipo: "grupo", grupo: bloque.grupo, secciones: [bloque] });
      }
    } else {
      filas.push({ tipo: "section", seccion: bloque });
    }
  });

  const renderSeccion = (bloque, compacta = false) => (
    <section
      key={bloque.titulo || "default"}
      className={`form-section form-section--card ${compacta ? "form-section--half" : ""}`}
    >
      {bloque.titulo && <h3 className="form-section-title">{bloque.titulo}</h3>}
      <div className={`form-grid ${compacta ? "form-grid--half" : "form-grid--page"}`}>
        {bloque.campos.map(renderCampo)}
      </div>
    </section>
  );

  return (
    <div className="mantenedor-page form-page">
      <PageHeader
        modulo={modulo}
        listado={listado}
        vista={vista || titulo}
        titulo={titulo}
        mostrarNuevo={false}
        onListadoClick={onCancel}
      />

      <form className="form-page-card" onSubmit={handleSubmit}>
        <div className="form-page-body">
          {errors._form && <p className="field-error form-error-banner">{errors._form}</p>}
          {filas.map((fila, idx) =>
            fila.tipo === "grupo" ? (
              <div key={fila.grupo || idx} className="form-section-row">
                {fila.secciones.map((sec) => renderSeccion(sec, true))}
              </div>
            ) : (
              renderSeccion(fila.seccion)
            ),
          )}
          {pie}
        </div>

        <div className="form-page-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>
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
  );
}
