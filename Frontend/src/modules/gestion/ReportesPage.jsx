import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel, faFilePdf, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { dbToView, hoyInput, primerDiaMesInput, inputToDb } from "../../utils/fecha";
import { exportarTabla } from "../../utils/reporteTabla";
import { abrirEstadoCuenta } from "../../utils/estadoCuenta";
import TablaGestion from "./TablaGestion";
import "../../styles/mantenedor.css";
import "./gestion.css";

const TIPOS = [
  { value: "matriculas", label: "Matrículas por fecha", fechas: true },
  { value: "mensualidades", label: "Mensualidades (pagadas y pendientes)", fechas: true },
  { value: "pagos", label: "Pagos de mensualidades", fechas: true },
  { value: "ventas", label: "Ventas", fechas: true },
  { value: "abonos", label: "Abonos y pagos de ventas", fechas: true },
  { value: "productos", label: "Productos vendidos", fechas: true },
  { value: "clases", label: "Clases individuales", fechas: true },
  { value: "saldos", label: "Saldos pendientes", fechas: false },
  { value: "ingresos", label: "Ingresos por categoría", fechas: true },
  { value: "activas", label: "Alumnas activas", fechas: false },
  { value: "asistencias", label: "Asistencias por alumna", fechas: true },
  { value: "retiradas", label: "Alumnas inactivas o retiradas", fechas: true },
  { value: "cumpleanos", label: "Cumpleaños", fechas: false },
];

export default function ReportesPage() {
  const [tipo, setTipo] = useState("matriculas");
  const [desde, setDesde] = useState(primerDiaMesInput());
  const [hasta, setHasta] = useState(hoyInput());
  const [idCiclo, setIdCiclo] = useState("");
  const [ciclos, setCiclos] = useState([]);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const definicion = TIPOS.find((t) => t.value === tipo);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/catalogos/");
        const data = await parseJsonResponse(res);
        if (res.ok) setCiclos(data.data?.ciclos || []);
      } catch {
        /* sin filtro de categoría */
      }
    })();
  }, []);

  const consultar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const params = new URLSearchParams({ idciclo: idCiclo });
      if (definicion?.fechas) {
        params.set("desde", desde);
        params.set("hasta", hasta);
      }
      const res = await fetch(`/api/reportes/${tipo}/?${params}`);
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || data.mensaje || "No se pudo generar el reporte");
      setReporte(data.data);
    } catch (err) {
      setError(err.message);
      setReporte(null);
    } finally {
      setCargando(false);
    }
  }, [tipo, desde, hasta, idCiclo, definicion]);

  useEffect(() => {
    consultar();
  }, [consultar]);

  const metadatos = () => [
    definicion?.fechas && desde && hasta ? `Del ${dbToView(inputToDb(desde))} al ${dbToView(inputToDb(hasta))}` : null,
    idCiclo ? `Categoría: ${ciclos.find((c) => c.value === idCiclo)?.label || idCiclo}` : "Todas las categorías",
  ].filter(Boolean);

  const exportar = (formato) => reporte && exportarTabla({
    titulo: reporte.titulo,
    metadatos: metadatos(),
    columnas: reporte.columnas,
    filas: reporte.filas,
    totales: reporte.totales,
    archivo: `Reporte-${tipo}-${inputToDb(hasta) || ""}`,
    formato,
  });

  const columnas = (reporte?.columnas || []).map((col) => (
    col.key === "ESTADO"
      ? {
        ...col,
        render: (f) => {
          const tono = { Emitido: "ok", Completada: "ok", Activa: "ok", Anulado: "peligro", Deuda: "peligro", Retirada: "peligro", Parcial: "aviso", Inactiva: "aviso", Inactivo: "aviso" }[f.ESTADO];
          return f.ESTADO ? <span className={`gestion-chip ${tono ? `gestion-chip--${tono}` : ""}`}>{f.ESTADO}</span> : "—";
        },
      }
      : col
  ));

  return (
    <div className="mantenedor-page">
      <div className="page-header gestion-head">
        <h1>Reportes administrativos</h1>
      </div>

      <section className="mantenedor-card">
        <div className="gestion-barra">
          <div className="gestion-filtros">
            <label>
              Reporte
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            {definicion?.fechas && (
              <>
                <label>
                  Desde
                  <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
                </label>
                <label>
                  Hasta
                  <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
                </label>
              </>
            )}
            <label>
              Categoría
              <select value={idCiclo} onChange={(e) => setIdCiclo(e.target.value)}>
                <option value="">Todas</option>
                {ciclos.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <button type="button" className="btn-secondary toolbar-reporte" onClick={consultar} disabled={cargando}>
              <FontAwesomeIcon icon={faMagnifyingGlass} /> Actualizar
            </button>
          </div>
          <div className="toolbar-reporte-grupo">
            <button type="button" className="btn-primary toolbar-reporte" disabled={!reporte?.filas?.length} onClick={() => exportar("excel")}>
              <FontAwesomeIcon icon={faFileExcel} /> Excel
            </button>
            <button type="button" className="btn-secondary toolbar-reporte" disabled={!reporte?.filas?.length} onClick={() => exportar("pdf")}>
              <FontAwesomeIcon icon={faFilePdf} /> PDF
            </button>
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}
        {reporte && (
          <p className="gestion-nota">
            <strong>{reporte.titulo}</strong> · {reporte.filas.length} registros · {metadatos().join(" · ")}
            {tipo === "ventas" && " · Los totales solo consideran recibos emitidos."}
          </p>
        )}

        <TablaGestion
          columnas={columnas}
          filas={reporte?.filas || []}
          totales={reporte?.totales}
          cargando={cargando}
          vacio="No hay registros para los filtros elegidos."
          onFila={reporte?.filas?.some((f) => f.IDALUMNA) ? (f) => f.IDALUMNA && abrirEstadoCuenta(f.IDALUMNA) : undefined}
        />
      </section>
    </div>
  );
}
