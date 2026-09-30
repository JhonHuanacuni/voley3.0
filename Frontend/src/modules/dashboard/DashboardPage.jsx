import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faMoneyBill, faShirt, faReceipt, faCalendarCheck } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import "../../styles/mantenedor.css";
import "./dashboard.css";

function dinero(valor) {
  const n = Number(valor || 0);
  return n.toLocaleString("es-PE", { style: "currency", currency: "PEN" });
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
    { icono: faUsers, etiqueta: "Alumnas activas", valor: resumen.ALUMNASACTIVAS ?? "—", tono: "primary" },
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
      <section className="mantenedor-card">
        <h2>Asistencias del mes por turno</h2>
        <ul className="dash-turnos">
          {(data?.turnos || []).map((turno) => (
            <li key={turno.NOMBRE}>
              <span>{turno.NOMBRE}</span>
              <strong>{turno.PRESENTES}</strong>
            </li>
          ))}
          {data && !(data.turnos || []).length && <li>Sin turnos activos.</li>}
        </ul>
      </section>
    </div>
  );
}
