import { dbToView } from "../../utils/fecha";
import { etiquetaOperacion } from "../../utils/auditoria";

const valorVista = (campo, valor) => {
  if (valor === null || valor === undefined || valor === "") return "—";
  const texto = typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  if (/^\d{8}$/.test(texto) && /FECHA|MENSUALIDAD$/.test(campo)) return dbToView(texto);
  return texto;
};

function filasCambios(registro) {
  const antes = registro.VALORANTERIOR || {};
  const despues = registro.VALORNUEVO || {};
  const campos = [...new Set([...Object.keys(despues), ...Object.keys(antes)])];
  const cambiados = new Set(String(registro.CAMPOS || "").split(",").map((c) => c.trim()).filter(Boolean));
  return campos.map((campo) => ({
    campo,
    antes: campo in antes ? valorVista(campo, antes[campo]) : "—",
    despues: campo in despues ? valorVista(campo, despues[campo]) : "—",
    cambiado: cambiados.has(campo),
  }));
}

export default function DetalleAuditoriaModal({ registro, onClose }) {
  const operacion = etiquetaOperacion(registro.OPERACION);
  const cambios = filasCambios(registro);
  const datos = [
    ["Fecha y hora", `${dbToView(String(registro.FECHA || ""))} ${registro.HORA || ""}`],
    ["Usuario", registro.IDUSUARIO || "Sin usuario de la aplicación"],
    ["Acción", registro.ACCION],
    ["Tabla", registro.TABLA],
    ["Registro", registro.IDREGISTRO],
    ["Alumna", registro.IDALUMNA],
    ["Módulo", registro.MODULO],
    ["Procedimiento", registro.PROCEDIMIENTO],
    ["Petición", [registro.METODO, registro.RUTA].filter(Boolean).join(" ")],
    ["IP", registro.IP],
    ["Navegador", registro.NAVEGADOR],
    ["Usuario de base de datos", registro.USUARIOBD],
    ["Solicitud", registro.SOLICITUD],
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel modal-panel--wide modal-panel--form"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auditoria-detalle-titulo"
      >
        <div className="modal-header">
          <h2 id="auditoria-detalle-titulo">
            Movimiento {registro.IDAUDITORIA}{" "}
            <span className={`auditoria-accion auditoria-accion--${operacion.clase}`}>{operacion.label}</span>
          </h2>
        </div>
        <div className="modal-body">
          {registro.DETALLE && <p className="auditoria-detalle-texto">{registro.DETALLE}</p>}
          <dl className="auditoria-detalle-datos">
            {datos.filter(([, valor]) => valor).map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>
          {cambios.length > 0 && (
            <>
              <h3 className="form-section-title">
                {registro.OPERACION === "UPDATE" ? "Campos modificados" : "Datos del registro"}
              </h3>
              <div className="auditoria-cambios-scroll">
                <table className="auditoria-cambios">
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Valor anterior</th>
                      <th>Valor nuevo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cambios.map((fila) => (
                      <tr key={fila.campo} className={fila.cambiado ? "is-cambiado" : ""}>
                        <td>{fila.campo}</td>
                        <td>{fila.antes}</td>
                        <td>{fila.despues}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
