import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faUserPlus, faMoneyBill, faShirt, faReceipt, faCalendarCheck } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { dbToView, hoyInput, primerDiaMesInput, ultimoDiaMesInput } from "../../utils/fecha";
import GraficoBarras from "../../components/graficos/GraficoBarras";
import useConsulta from "../../hooks/useConsulta";
import "../../styles/mantenedor.css";
import "./dashboard.css";

const TIPO_NUEVA = "Matrícula nueva";
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const SERIES_ASISTENCIA = [
  { clave: "PRESENTES", nombre: "Asistencias", color: "#34d399" },
  { clave: "FALTAS", nombre: "Faltas", color: "#ef6f61" },
  { clave: "TARDANZAS", nombre: "Tardanzas", color: "#fbbf24" },
];

const SERIES_FINANZAS = [
  { clave: "PAGOS", nombre: "Pagos de mensualidades", color: "#6d8be8" },
  { clave: "VENTAS", nombre: "Ventas cobradas", color: "#34d399" },
  { clave: "EGRESOS", nombre: "Egresos", color: "#ef6f61" },
];

function dinero(valor) {
  const n = Number(valor || 0);
  return n.toLocaleString("es-PE", { style: "currency", currency: "PEN" });
}

function dineroCorto(valor) {
  return `S/ ${Number(valor || 0).toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
}

function detalleTurno(fila) {
  const presentes = Number(fila.PRESENTES) || 0;
  const registros = SERIES_ASISTENCIA.reduce((suma, s) => suma + (Number(fila[s.clave]) || 0), 0);
  const porcentaje = registros ? Math.round((presentes / registros) * 100) : 0;
  return [
    `Total turno: ${Number(fila.ALUMNAS) || 0} alumnas`,
    `Asistencia: ${presentes}/${registros} (${porcentaje}%)`,
  ];
}

function detalleMes(fila) {
  const ingresos = (Number(fila.PAGOS) || 0) + (Number(fila.VENTAS) || 0);
  return [`Ingresos: ${dineroCorto(ingresos)}`, `Balance: ${dineroCorto(ingresos - (Number(fila.EGRESOS) || 0))}`];
}

function Asistencias() {
  const [desde, setDesde] = useState(primerDiaMesInput());
  const [hasta, setHasta] = useState(hoyInput());
  const [idTurno, setIdTurno] = useState("");
  const [turnos, setTurnos] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/catalogos/");
        const body = await parseJsonResponse(res);
        if (res.ok) setTurnos(body.data?.turnos || []);
      } catch {
        /* sin filtro de turno */
      }
    })();
  }, []);

  const rangoValido = desde && hasta && desde <= hasta;
  const url = rangoValido
    ? `/api/dashboard/asistencias/?${new URLSearchParams({ desde, hasta, idturno: idTurno })}`
    : "";
  const { data, error, cargando } = useConsulta(url);

  const totales = data?.totales || {};
  const registros = SERIES_ASISTENCIA.reduce((suma, s) => suma + (totales[s.clave] || 0), 0);
  const porcentaje = (n) => (registros ? (n / registros) * 100 : 0);
  const filas = data?.turnos || [];

  return (
    <section className="mantenedor-card dash-panel">
      <div className="dash-panel-head">
        <h2>Asistencias</h2>
        <div className="dash-panel-filtros">
          <label className="toolbar-date">
            <span>Desde</span>
            <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="toolbar-date">
            <span>Hasta</span>
            <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <select value={idTurno} onChange={(e) => setIdTurno(e.target.value)}>
            <option value="">Todos los turnos</option>
            {turnos.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {!rangoValido && <p className="field-error dash-panel-msg">La fecha desde no puede ser mayor que la fecha hasta.</p>}
      {error && <p className="field-error dash-panel-msg">{error}</p>}

      <div className={`dash-asistencias ${cargando ? "is-cargando" : ""}`}>
        <div className="dash-asistencias-resumen">
          <h3>Resumen del periodo</h3>
          <p className="dash-panel-nota">{registros} registros de asistencia entre las fechas elegidas.</p>
          <div className="dash-proporcion" aria-hidden="true">
            {SERIES_ASISTENCIA.map((s) => (
              <span key={s.clave} style={{ width: `${porcentaje(totales[s.clave] || 0)}%`, background: s.color }} />
            ))}
          </div>
          <ul className="dash-asistencias-cifras">
            {SERIES_ASISTENCIA.map((s) => (
              <li key={s.clave}>
                <i style={{ background: s.color }} />
                <span>{s.nombre}</span>
                <strong>{totales[s.clave] || 0}</strong>
                <em>{porcentaje(totales[s.clave] || 0).toFixed(1)}%</em>
              </li>
            ))}
          </ul>
        </div>
        <div className="dash-asistencias-turnos">
          <h3>Por turno</h3>
          <GraficoBarras
            categorias={filas.map((f) => (f.HORAINICIO ? `${f.TURNO} (${f.HORAINICIO} - ${f.HORAFIN})` : f.TURNO))}
            series={SERIES_ASISTENCIA}
            filas={filas}
            mostrarValores
            enteros
            detalle={detalleTurno}
            vacio="No hay asistencias registradas en este periodo."
          />
        </div>
      </div>
    </section>
  );
}

function Finanzas() {
  const [meses, setMeses] = useState("6");
  const { data, error, cargando } = useConsulta(`/api/dashboard/finanzas/?meses=${meses}`);
  const filas = data?.meses || [];
  const etiquetaMes = (mes) => {
    const [anio, numero] = String(mes).split("-");
    return `${MESES_CORTOS[Number(numero) - 1] || numero} ${anio}`;
  };

  return (
    <section className="mantenedor-card dash-panel">
      <div className="dash-panel-head">
        <h2>Ingresos y egresos por mes</h2>
        <div className="dash-panel-filtros">
          <select value={meses} onChange={(e) => setMeses(e.target.value)}>
            <option value="3">Últimos 3 meses</option>
            <option value="6">Últimos 6 meses</option>
            <option value="12">Últimos 12 meses</option>
          </select>
        </div>
      </div>
      {error && <p className="field-error dash-panel-msg">{error}</p>}
      <div className={`dash-finanzas ${cargando ? "is-cargando" : ""}`}>
        <GraficoBarras
          categorias={filas.map((f) => etiquetaMes(f.MES))}
          series={SERIES_FINANZAS}
          filas={filas}
          formato={dineroCorto}
          detalle={detalleMes}
          alto={260}
        />
      </div>
    </section>
  );
}

function MatriculasPeriodo() {
  const [desde, setDesde] = useState(primerDiaMesInput());
  const [hasta, setHasta] = useState(ultimoDiaMesInput());
  const [tipo, setTipo] = useState("");
  const rangoValido = desde && hasta && desde <= hasta;
  const consulta = useConsulta(rangoValido ? `/api/dashboard/matriculas/?desde=${desde}&hasta=${hasta}` : "");
  const data = rangoValido ? consulta.data : null;
  const error = rangoValido ? consulta.error : "La fecha desde no puede ser mayor que la fecha hasta.";
  const cargando = consulta.cargando;

  const detalle = (data?.detalle || []).filter((fila) => !tipo || fila.TIPO === tipo);

  return (
    <section className="mantenedor-card dash-panel">
      <div className="dash-panel-head">
        <h2>Matrículas por periodo</h2>
        <div className="dash-panel-filtros">
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

      {error && <p className="field-error dash-panel-msg">{error}</p>}

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
      <Asistencias />
      <Finanzas />
      <MatriculasPeriodo />
    </div>
  );
}
