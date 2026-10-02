import { articulosBoleta, descargarBoletaPdf, fechaBoleta, lineasBoleta, numeroBoleta, sellosBoleta, soles } from "../../utils/boletaVenta";

export default function BoletaVenta({ venta, onClose }) {
  if (!venta) return null;
  const numero = numeroBoleta(venta);
  const estado = String(venta.ESTADO_RECIBO || "").toLowerCase();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel boleta-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Boleta {numero}</h2>
        </div>
        <div className="modal-body">
          <article className="boleta-hoja">
            <p className="boleta-academia">Academia Vita</p>
            <h3>Boleta de venta</h3>
            <p className="boleta-meta">Nro. {numero}</p>
            <p className="boleta-meta">Fecha {fechaBoleta(venta)}</p>
            {(estado === "anulado" || estado === "eliminado") && (
              <p className={`boleta-sello ${estado}`}>{estado === "anulado" ? "ANULADO" : "ELIMINADO"}</p>
            )}
            <dl>
              {lineasBoleta(venta).map(([etiqueta, valor]) => (
                <div key={etiqueta}>
                  <dt>{etiqueta}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
            <table className="boleta-items">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {articulosBoleta(venta).map((item, indice) => (
                  <tr key={item.IDDETALLE || `${item.PRODUCTO}-${indice}`}>
                    <td>
                      {item.PRODUCTO}
                      {item.TALLA ? <small>Talla {item.TALLA}</small> : null}
                    </td>
                    <td>{soles(item.PRECIO)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="boleta-total">Total {soles(venta.PRECIO)}</p>
            {sellosBoleta(venta).length > 0 && (
              <dl className="boleta-sellos">
                {sellosBoleta(venta).map(([etiqueta, valor]) => (
                  <div key={etiqueta}>
                    <dt>{etiqueta}</dt>
                    <dd>{valor}</dd>
                  </div>
                ))}
              </dl>
            )}
            {venta.TIPO === "Servicio" && (
              <p className="boleta-nota">Documento interno de la academia. No modifica la mensualidad.</p>
            )}
          </article>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn-primary" onClick={() => descargarBoletaPdf(venta)}>
            Descargar boleta
          </button>
        </div>
      </div>
    </div>
  );
}
