import { valorCelda } from "../../utils/reporteTabla";

export function dinero(valor) {
  const n = Number(valor || 0);
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TablaGestion({ columnas, filas, totales, onFila, vacio = "No hay registros.", cargando, claveFila }) {
  return (
    <div className="data-table-wrap gestion-tabla">
      <table className="data-table">
        <thead>
          <tr>
            {columnas.map((col) => (
              <th key={col.key} className={col.formato === "moneda" || col.formato === "entero" ? "gestion-num" : ""}>
                {col.label}
              </th>
            ))}
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
                  {col.render ? col.render(fila) : valorCelda(fila[col.key], col.formato) || "—"}
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
