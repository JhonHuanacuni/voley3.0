import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faUserPlus, faMoneyBill, faShirt, faReceipt, faCalendarCheck } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { dbToView, primerDiaMesInput, ultimoDiaMesInput } from "../../utils/fecha";
import "../../styles/mantenedor.css";
import "./dashboard.css";

const TIPO_NUEVA = "Matrícula nueva";

function dinero(valor) {
  const n = Number(valor || 0);
  return n.toLocaleString("es-PE", { style: "currency", currency: "PEN" });
}

function MatriculasPeriodo() {
  const [desde, setDesde] = useState(primerDiaMesInput());
  const [hasta, setHasta] = useState(ultimoDiaMesInput());
  const [tipo, setTipo] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!desde || !hasta) return;
    if (desde > hasta) {
      setError("La fecha desde no puede ser mayor que la fecha hasta.");
      setData(null);
      return;
    }
    let vigente = true;
    setCargando(true);
    setError("");
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/matriculas/?desde=${desde}&hasta=${hasta}`);
        const body = await parseJsonResponse(res);
        if (!res.ok) throw new Error(body.error || "No se pudieron cargar las matrículas");
        if (vigente) setData(body.data);
      } catch (err) {
        if (vigente) setError(err.message);
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [desde, hasta]);

  const detalle = (data?.detalle || []).filter((fila) => !tipo || fila.TIPO === tipo);

  return (
    <section className="mantenedor-card dash-matriculas">
      <div className="dash-matriculas-head">
        <h2>Matrículas por periodo</h2>
        <div className="dash-matriculas-filtros">
          <label className="toolbar-date">
            <span>Desde</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="toolbar-date">
            <span>Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value={TIPO_NUEVA}>Matrículas nuevas</option>
            <option value="Mensualidad">Mensualidades de antiguas</option>
          </select>
        </div>
      </div>

      {error && <p className="field-error dash-matriculas-msg">{error}</p>}

      <div className="dash-matriculas-resumen">
        <div className="dash-matriculas-cifra dash-matriculas-cifra--nueva">
          <span>Matrículas nuevas</span>
          <strong>{data ? data.nuevas : "—"}</strong>
        </div>
        <div className="dash-matriculas-cifra dash-matriculas-cifra--mensualidad">
          <span>Mensualidades de alumnas antiguas</span>
          <strong>{data ? data.mensualidades : "—"}</strong>
        </div>
      </div>

      <div className="data-table-wrap dash-matriculas-tabla">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Alumna</th>
              <th>Tipo</th>
              <th>Turno</th>
              <th>Monto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {detalle.map((fila, i) => (
              <tr key={`${fila.TIPO}-${fila.IDALUMNA}-${fila.FECHA}-${i}`}>
                <td>{dbToView(fila.FECHA)}</td>
                <td>{String(fila.NOMBRE || "").toUpperCase()}</td>
                <td>
                  <span className={`dash-tipo ${fila.TIPO === TIPO_NUEVA ? "dash-tipo--nueva" : "dash-tipo--mensualidad"}`}>
                    {fila.TIPO === TIPO_NUEVA ? "Nueva" : "Mensualidad"}
                  </span>
                </td>
                <td>{fila.TURNO || "—"}</td>
                <td>{fila.MONTO != null ? dinero(fila.MONTO) : "—"}</td>
                <td>{fila.ESTADO}</td>
              </tr>
            ))}
            {!cargando && data && !detalle.length && (
              <tr>
                <td colSpan={6} className="dash-matriculas-vacio">No hay registros en este periodo.</td>
              </tr>
            )}
            {cargando && (
              <tr>
                <td colSpan={6} className="dash-matriculas-vacio">Cargando…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dashboard/");
        const body = await parseJsonResponse(res);
        if (!res.ok) throw new Error(body.error || "No se pudo cargar el dashboard");
        setData(body.data);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  const resumen = data?.resumen || {};
  const tarjetas = [
    { icono: faUsers, etiqueta: "Alumnas activas (total)", valor: resumen.ALUMNASACTIVAS ?? "—", tono: "primary" },
    { icono: faUserPlus, etiqueta: "Matrículas nuevas de hoy", valor: resumen.MATRICULASHOY ?? "—", tono: "nueva" },
    { icono: faMoneyBill, etiqueta: "Pagos del mes", valor: data ? dinero(resumen.PAGOSMES) : "—", tono: "ok" },
    { icono: faShirt, etiqueta: "Ventas del mes", valor: data ? dinero(resumen.VENTASMES) : "—", tono: "ok" },
    { icono: faReceipt, etiqueta: "Egresos del mes", valor: data ? dinero(resumen.EGRESOSMES) : "—", tono: "warn" },
    { icono: faCalendarCheck, etiqueta: "Asistencias del mes", valor: resumen.ASISTENCIASMES ?? "—", tono: "primary" },
  ];

  return (
    <div className="mantenedor-page">
      <div className="page-header"><h1>Dashboard</h1></div>
      {error && <p className="field-error">{error}</p>}
      <section className="dash-grid">
        {tarjetas.map((item) => (
          <article key={item.etiqueta} className={`dash-kpi dash-kpi--${item.tono}`}>
            <FontAwesomeIcon icon={item.icono} />
            <div>
              <p>{item.etiqueta}</p>
              <strong>{item.valor}</strong>
            </div>
          </article>
        ))}
      </section>
      <MatriculasPeriodo />
    </div>
  );
}
