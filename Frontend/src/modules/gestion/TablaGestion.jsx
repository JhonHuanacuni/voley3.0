import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import { textoCelda, valorCelda } from "../../utils/reporteTabla";

const esOrdenable = (col) => Boolean(col.formato) && col.ordenable !== false;
const campoOrden = (col) => col.campoOrden || col.key;

function IconoOrden({ col, orden }) {
  if (orden?.campo !== campoOrden(col)) return <FontAwesomeIcon icon={faSort} className="gestion-orden-icono" />;
  return <FontAwesomeIcon icon={orden.direccion === "ASC" ? faSortUp : faSortDown} className="gestion-orden-icono is-activo" />;
}

export default function TablaGestion({
  columnas,
  filas,
  totales,
  onFila,
  vacio = "No hay registros.",
  cargando,
  claveFila,
  paginada = false,
  orden,
  onOrdenar,
}) {
  return (
    <div className={`data-table-wrap gestion-tabla ${paginada ? "gestion-tabla--paginada" : ""}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columnas.map((col) => {
              const ordenable = Boolean(onOrdenar) && esOrdenable(col);
              const clases = [
                col.formato === "moneda" || col.formato === "entero" ? "gestion-num" : "",
                ordenable ? "sortable" : "",
              ].filter(Boolean).join(" ");
              return (
                <th
                  key={col.key}
                  className={clases}
                  onClick={ordenable ? () => onOrdenar(campoOrden(col)) : undefined}
                  title={ordenable ? "Ordenar" : undefined}
                  aria-sort={orden?.campo === campoOrden(col) ? (orden.direccion === "ASC" ? "ascending" : "descending") : undefined}
                >
                  {col.label} {ordenable && <IconoOrden col={col} orden={orden} />}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {cargando && (
            <tr>
              <td colSpan={columnas.length} className="gestion-vacio">Cargando…</td>
            </tr>
          )}
          {!cargando && !filas.length && (
            <tr>
              <td colSpan={columnas.length} className="gestion-vacio">{vacio}</td>
            </tr>
          )}
          {!cargando && filas.map((fila, indice) => (
            <tr
              key={claveFila ? claveFila(fila, indice) : indice}
              className={onFila ? "gestion-fila-link" : ""}
              onClick={onFila ? () => onFila(fila) : undefined}
            >
              {columnas.map((col) => (
                <td key={col.key} className={col.formato === "moneda" || col.formato === "entero" ? "gestion-num" : ""}>
                  {col.render ? col.render(fila) : textoCelda(fila, col) || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {!cargando && totales && Object.keys(totales).length > 0 && filas.length > 0 && (
          <tfoot>
            <tr>
              {columnas.map((col, i) => (
                <td key={col.key} className={col.formato === "moneda" || col.formato === "entero" ? "gestion-num" : ""}>
                  {i === 0 ? "Total" : totales[col.key] != null ? valorCelda(totales[col.key], col.formato) : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
