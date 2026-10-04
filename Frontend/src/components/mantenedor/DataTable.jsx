import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faPencil,
  faTrash,
  faDownload,
  faKey,
  faCommentDots,
  faSort,
  faSortUp,
  faSortDown,
  faImage,
  faListUl,
  faUserSlash,
  faBan,
} from "@fortawesome/free-solid-svg-icons";
import { dbToView, diasRestantesDesdeDb, textoDiasRestantes, claseDiasRestantes } from "../../utils/fecha";
import { resumenDiasAsistencia } from "../../utils/diasPlan";
import { etiquetaOperacion } from "../../utils/auditoria";

function esEstudianteRetirado(row) {
  return String(row?.ESTUDIANTE_ESTADO || "").trim().toLowerCase() === "retirado";
}

function renderCell(col, row, index = 0, offset = 0) {
  if (col.tipo === "numero") {
    return offset + index + 1;
  }

  const value = row[col.campo];

  if (col.tipo === "diasRestantes") {
    const dias = diasRestantesDesdeDb(row[col.origen || "FECHAFIN"]);
    return (
      <span className={`dias-vence ${claseDiasRestantes(dias)}`}>
        {textoDiasRestantes(dias)}
      </span>
    );
  }

  if (col.tipo === "estadoMensualidad") {
    if (value == null || value === "") return "—";
    const v = String(value).toLowerCase();
    const clase = v === "activo" ? "activo" : v === "vencido" ? "vencido" : "inactivo";
    return <span className={`badge-estado ${clase}`}>{value}</span>;
  }

  if (col.tipo === "diasAsistencia") {
    return <span className="dias-asistencia-resumen">{resumenDiasAsistencia(value)}</span>;
  }

  if (col.tipo === "rangoFecha") {
    const a = dbToView(String(row[col.campo] || ""));
    const b = dbToView(String(row[col.campoFin] || ""));
    if (!a && !b) return "—";
    return `${a || "—"} — ${b || "—"}`;
  }

  if (col.tipo === "deudaCompletado") {
    if (esEstudianteRetirado(row)) {
      return <span className="badge-estado inactivo">Retirado</span>;
    }
    const n = Number(value);
    if (value == null || value === "" || Number.isNaN(n) || n <= 0) {
      return <span className="badge-estado activo">Completado</span>;
    }
    return (
      <span className="badge-estado vencido">
        S/ {n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  }

  if (col.tipo === "fecha") {
    return dbToView(String(value || "")) || "—";
  }

  if (col.tipo === "hora") {
    const s = String(value || "");
    return s.length >= 5 ? s.slice(0, 5) : "—";
  }

  if (col.tipo === "minutos") {
    const n = Number(value);
    if (Number.isNaN(n)) return "—";
    return `${n} min`;
  }

  if (value == null || value === "") return "—";

  if (col.mayusculas) {
    return String(value).toUpperCase();
  }

  if (col.tipo === "estadoPago") {
    const v = String(value).toLowerCase();
    const clase = v === "completada" ? "activo" : v === "parcial" ? "parcial" : v === "deuda" ? "vencido" : "inactivo";
    return <span className={`badge-estado ${clase}`}>{value}</span>;
  }
  if (col.tipo === "traza") {
    const [usuario, cuando] = String(value).split(" – ");
    return (
      <span title={`Registrado por ${value}`}>
        {usuario}
        {cuando && <span className="traza-linea">{cuando}</span>}
      </span>
    );
  }
  if (col.tipo === "estado") {
    const activo = ["activo", "activa", "completada", "presente", "emitido"].includes(String(value).toLowerCase());
    return (
      <span className={`badge-estado ${activo ? "activo" : "inactivo"}`}>
        {value}
      </span>
    );
  }
  if (col.tipo === "asistenciaEstado") {
    const justificado =
      row.JUSTIFICADO === true ||
      row.JUSTIFICADO === 1 ||
      row.JUSTIFICADO === "1" ||
      String(row.JUSTIFICADO || "").toLowerCase() === "true";
    if (justificado) {
      return <span className="badge-estado activo">Justificado</span>;
    }
    const v = String(value || "").toLowerCase();
    if (v === "presente" || v === "asistencia") {
      return <span className="badge-estado activo">Presente</span>;
    }
    if (v === "tarde") {
      return <span className="badge-estado inactivo">Tarde</span>;
    }
    if (v.includes("justific")) {
      return <span className="badge-estado activo">Justificado</span>;
    }
    if (v === "falta" || v === "ausente") {
      return <span className="badge-estado vencido">Falta</span>;
    }
    return <span className="badge-estado">{value || "—"}</span>;
  }
  if (col.tipo === "visibleExamen") {
    const on = value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
    return (
      <span className={`badge-estado ${on ? "activo" : "inactivo"}`}>
        {on ? "Visible" : "Oculto"}
      </span>
    );
  }
  if (col.tipo === "nota") {
    const n = Number(value);
    if (value == null || value === "" || Number.isNaN(n)) return "—";
    return (
      <strong>
        {n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </strong>
    );
  }
  if (col.tipo === "resultadoTipo") {
    const origen = String(row.ORIGEN || row.TIPO_EXAMEN || "").toLowerCase();
    if (origen === "importado" || origen === "presencial") {
      const n = row.TIPO_IMPORTACION;
      return n ? `Presencial (${n})` : "Presencial";
    }
    return "Virtual";
  }
  if (col.tipo === "intentoEstado") {
    const fin = Number(row.ESTADOINTENTO) === 1;
    return (
      <span className={`badge-estado ${fin ? "activo" : ""}`}>
        {fin ? "Finalizado" : "En curso"}
      </span>
    );
  }
  if (col.tipo === "aprobadoEstado") {
    if (value == null || value === "") return "—";
    const ok = value === true || value === 1 || value === "1";
    return (
      <span className={`badge-estado ${ok ? "activo" : "vencido"}`}>
        {ok ? "Aprobado" : "Desaprobado"}
      </span>
    );
  }
  if (col.tipo === "tipoExamen") {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value ?? "—");
    return `${n} preguntas`;
  }
  if (col.tipo === "fecha") return dbToView(String(value));
  if (col.tipo === "deuda") {
    if (esEstudianteRetirado(row)) {
      return <span className="badge-estado inactivo">Retirado</span>;
    }
    const n = Number(value);
    if (value == null || value === "" || Number.isNaN(n) || n <= 0) {
      return <span className="badge-estado activo">Sin deuda</span>;
    }
    if (col.ocultarMonto) {
      return <span className="badge-estado vencido">Con deuda</span>;
    }
    return (
      <span className="badge-estado vencido">
        Con deuda (S/{" "}
        {n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
      </span>
    );
  }
  if (col.tipo === "decimal") {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (col.tipo === "saldoDeuda") {
    const n = Number(value);
    if (value == null || value === "" || Number.isNaN(n) || n <= 0) {
      return <span className="pex-saldo pex-saldo--ok">Sin deuda</span>;
    }
    return (
      <span className="pex-saldo pex-saldo--deuda">
        S/ {n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  }
  if (col.tipo === "porcentaje") {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return `${n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }
  if (col.tipo === "accionAuditoria") {
    const { clase, label } = etiquetaOperacion(value);
    return <span className={`auditoria-accion auditoria-accion--${clase}`}>{label}</span>;
  }
  return String(value);
}

const esOrdenable = (col) => col.ordenable !== false && col.tipo !== "numero";
const campoOrden = (col) => col.campoOrden || (col.tipo === "diasRestantes" ? col.origen || "FECHAFIN" : col.campo);

function SortIcon({ col, orden }) {
  if (!esOrdenable(col)) return null;
  if (orden?.campo !== campoOrden(col)) return <FontAwesomeIcon icon={faSort} />;
  return (
    <FontAwesomeIcon icon={orden.direccion === "ASC" ? faSortUp : faSortDown} />
  );
}

export default function DataTable({
  columnas,
  items,
  pk,
  orden,
  loading,
  error,
  onOrden,
  onVer,
  onEditar,
  onEliminar,
  onRetirar,
  campoEstado = "ESTADO",
  onCarnet,
  onResetContra,
  onWhatsapp,
  onVerPagos,
  onVerMensualidades,
  onVerBoleta,
  onAnular,
  onReintentar,
  accionesExtra = [],
  pagina = 1,
  tamanio = 10,
  verIcono = "eye",
  emptyMessage = "No hay registros. Crea el primero.",
}) {
  const mostrarAcciones = Boolean(
    onVer || onEditar || onEliminar || onRetirar || onCarnet || onResetContra || onWhatsapp || onVerPagos || onVerMensualidades || onAnular,
  );
  const offset = Math.max(0, (pagina - 1) * tamanio);
  if (loading) {
    return (
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c.campo}>{c.etiqueta}</th>
              ))}
              {onVerBoleta && <th>Ver boleta</th>}
              {mostrarAcciones && <th className="col-actions">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="skeleton-row">
                {columnas.map((c) => (
                  <td key={c.campo}>
                    <div className="skeleton-bar" />
                  </td>
                ))}
                {onVerBoleta && (
                  <td>
                    <div className="skeleton-bar" />
                  </td>
                )}
                {mostrarAcciones && (
                  <td>
                    <div className="skeleton-bar" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mantenedor-state error">
        <p>{error}</p>
        <button type="button" className="btn-secondary" onClick={onReintentar}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mantenedor-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columnas.map((col) => (
              <th
                key={col.campo}
                className={esOrdenable(col) && onOrden ? "sortable" : ""}
                onClick={() => esOrdenable(col) && onOrden?.(campoOrden(col))}
                title={esOrdenable(col) && onOrden ? "Ordenar" : undefined}
              >
                {col.etiqueta} {onOrden && <SortIcon col={col} orden={orden} />}
              </th>
            ))}
            {onVerBoleta && <th>Ver boleta</th>}
            {mostrarAcciones && <th className="col-actions">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr key={row[pk]}>
              {columnas.map((col) => (
                <td key={col.campo}>{renderCell(col, row, index, offset)}</td>
              ))}
              {onVerBoleta && (
                <td>
                  <button type="button" className="btn-boleta" onClick={() => onVerBoleta(row)}>
                    Ver boleta
                  </button>
                </td>
              )}
              {mostrarAcciones && (
                <td className="col-actions">
                  {onVer && (
                    <button
                      type="button"
                      className="btn-icon"
                      title={onVerPagos ? "Ver pago" : "Ver"}
                      onClick={() => onVer(row)}
                    >
                      <FontAwesomeIcon icon={verIcono === "image" ? faImage : faEye} />
                    </button>
                  )}
                  {onEditar && !["anulado", "eliminado"].includes(String(row.ESTADO_RECIBO || "").toLowerCase()) && (
                    <button
                      type="button"
                      className="btn-icon"
                      title="Editar"
                      onClick={() => onEditar(row)}
                    >
                      <FontAwesomeIcon icon={faPencil} />
                    </button>
                  )}
                  {onCarnet && (
                    <button
                      type="button"
                      className="btn-icon"
                      title="Descargar carnet"
                      onClick={() => onCarnet(row)}
                    >
                      <FontAwesomeIcon icon={faDownload} />
                    </button>
                  )}
                  {onResetContra && (
                    <button
                      type="button"
                      className="btn-icon"
                      title="Restablecer usuario y contraseña al DNI"
                      onClick={() => onResetContra(row)}
                    >
                      <FontAwesomeIcon icon={faKey} />
                    </button>
                  )}
                  {accionesExtra
                    .filter((accion) => !accion.visible || accion.visible(row))
                    .map((accion) => (
                      <button
                        key={accion.id}
                        type="button"
                        className={`btn-icon ${accion.clase || ""}`}
                        title={accion.titulo}
                        onClick={() => accion.onClick(row)}
                      >
                        <FontAwesomeIcon icon={accion.icono} />
                      </button>
                    ))}
                  {onWhatsapp && (
                    <button
                      type="button"
                      className="btn-icon btn-icon--whatsapp"
                      title="WhatsApp"
                      onClick={() => onWhatsapp(row)}
                    >
                      <FontAwesomeIcon icon={faCommentDots} />
                    </button>
                  )}
                  {onVerMensualidades && (
                    <button
                      type="button"
                      className="btn-icon"
                      title="Ver mensualidades del estudiante"
                      onClick={() => onVerMensualidades(row)}
                    >
                      <FontAwesomeIcon icon={faListUl} />
                    </button>
                  )}
                  {onVerPagos && (
                    <button
                      type="button"
                      className="btn-icon"
                      title="Ver listado de pagos"
                      onClick={() => onVerPagos(row)}
                    >
                      <FontAwesomeIcon icon={faListUl} />
                    </button>
                  )}
                  {onRetirar && (row[campoEstado] || "").trim().toUpperCase() !== "RETIRADO" && (
                    <button
                      type="button"
                      className="btn-icon danger"
                      title="Retirar usuario"
                      onClick={() => onRetirar(row)}
                    >
                      <FontAwesomeIcon icon={faUserSlash} />
                    </button>
                  )}
                  {onAnular && String(row.ESTADO_RECIBO || "").toLowerCase() === "emitido" && (
                    <button
                      type="button"
                      className="btn-icon danger"
                      title="Anular recibo"
                      onClick={() => onAnular(row)}
                    >
                      <FontAwesomeIcon icon={faBan} />
                    </button>
                  )}
                  {onEliminar && String(row.ESTADO_RECIBO || "").toLowerCase() !== "eliminado" && (!onRetirar || (row[campoEstado] || "").trim().toUpperCase() === "RETIRADO") && (
                    <button
                      type="button"
                      className="btn-icon danger"
                      title={onAnular ? "Eliminar recibo" : "Eliminar permanentemente"}
                      onClick={() => onEliminar(row)}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
