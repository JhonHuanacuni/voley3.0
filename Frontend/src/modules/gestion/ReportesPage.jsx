import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel, faFilePdf } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { dbToView, hoyInput, primerDiaMesInput, inputToDb } from "../../utils/fecha";
import { exportarTabla } from "../../utils/reporteTabla";
import { abrirEstadoCuenta } from "../../utils/estadoCuenta";
import Pagination from "../../components/mantenedor/Pagination";
import TablaGestion from "./TablaGestion";
import { siguienteOrden } from "./tablaGestionUtils";
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
  const [pagina, setPagina] = useState(1);
  const [tamanio, setTamanio] = useState(10);
  const [orden, setOrden] = useState(null);
  const [resultado, setResultado] = useState({ clave: "", reporte: null });
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");

  const definicion = TIPOS.find((t) => t.value === tipo);

  const ordenarPor = orden?.campo || "";
  const direccion = orden?.direccion || "";

  const filtrosParams = () => {
    const params = new URLSearchParams({ idciclo: idCiclo });
    if (definicion?.fechas) {
      params.set("desde", desde);
      params.set("hasta", hasta);
    }
    if (ordenarPor) {
      params.set("ordenarPor", ordenarPor);
      params.set("direccion", direccion);
    }
    return params;
  };

  const cambiarFiltro = (setter) => (valor) => {
    setter(valor);
    setPagina(1);
  };

  const cambiarTipo = (valor) => {
    setTipo(valor);
    setOrden(null);
    setPagina(1);
  };

  const ordenar = (campo) => {
    setOrden((actual) => siguienteOrden(actual, campo));
    setPagina(1);
  };

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

  const claveActual = [tipo, desde, hasta, idCiclo, pagina, tamanio, ordenarPor, direccion].join("|");

  useEffect(() => {
    let vigente = true;
    const clave = [tipo, desde, hasta, idCiclo, pagina, tamanio, ordenarPor, direccion].join("|");
    const params = new URLSearchParams({ idciclo: idCiclo, pagina: String(pagina), tamanio: String(tamanio) });
    if (TIPOS.find((t) => t.value === tipo)?.fechas) {
      params.set("desde", desde);
      params.set("hasta", hasta);
    }
    if (ordenarPor) {
      params.set("ordenarPor", ordenarPor);
      params.set("direccion", direccion);
    }
    (async () => {
      try {
        const res = await fetch(`/api/reportes/${tipo}/?${params}`);
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(data.error || data.mensaje || "No se pudo generar el reporte");
        if (!vigente) return;
        setError("");
        setResultado({ clave, reporte: data.data });
      } catch (err) {
        if (!vigente) return;
        setError(err.message);
        setResultado({ clave, reporte: null });
      }
    })();
    return () => {
      vigente = false;
    };
  }, [tipo, desde, hasta, idCiclo, pagina, tamanio, ordenarPor, direccion]);

  const cargando = resultado.clave !== claveActual;
  const reporte = resultado.reporte;

  const metadatos = () => [
    definicion?.fechas && desde && hasta ? `Del ${dbToView(inputToDb(desde))} al ${dbToView(inputToDb(hasta))}` : null,
    idCiclo ? `Categoría: ${ciclos.find((c) => c.value === idCiclo)?.label || idCiclo}` : "Todas las categorías",
  ].filter(Boolean);

  const exportar = async (formato) => {
    setExportando(true);
    try {
      const params = filtrosParams();
      params.set("todo", "1");
      const res = await fetch(`/api/reportes/${tipo}/?${params}`);
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || data.mensaje || "No se pudo generar el reporte");
      const completo = data.data;
      await exportarTabla({
        titulo: completo.titulo,
        metadatos: metadatos(),
        columnas: completo.columnas,
        filas: completo.filas,
        totales: completo.totales,
        archivo: `Reporte-${tipo}-${inputToDb(hasta) || ""}`,
        formato,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setExportando(false);
    }
  };

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
              <select value={tipo} onChange={(e) => cambiarTipo(e.target.value)}>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            {definicion?.fechas && (
              <>
                <label>
                  Desde
                  <input type="date" value={desde} max={hasta || undefined} onChange={(e) => cambiarFiltro(setDesde)(e.target.value)} />
                </label>
                <label>
                  Hasta
                  <input type="date" value={hasta} min={desde || undefined} onChange={(e) => cambiarFiltro(setHasta)(e.target.value)} />
                </label>
              </>
            )}
            <label>
              Categoría
              <select value={idCiclo} onChange={(e) => cambiarFiltro(setIdCiclo)(e.target.value)}>
                <option value="">TODAS LAS CATEGORÍAS</option>
                {ciclos.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <div className="toolbar-reporte-grupo">
            <button type="button" className="btn-primary toolbar-reporte" disabled={!reporte?.total || exportando} onClick={() => exportar("excel")}>
              <FontAwesomeIcon icon={faFileExcel} /> Excel
            </button>
            <button type="button" className="btn-secondary toolbar-reporte" disabled={!reporte?.total || exportando} onClick={() => exportar("pdf")}>
              <FontAwesomeIcon icon={faFilePdf} /> PDF
            </button>
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}
        {reporte && (
          <p className="gestion-nota">
            <strong>{reporte.titulo}</strong> · {reporte.total} registros · {metadatos().join(" · ")}
            {tipo === "ventas" && " · Los totales solo consideran recibos emitidos."}
          </p>
        )}

        <TablaGestion
          paginada
          orden={orden}
          onOrdenar={ordenar}
          columnas={columnas}
          filas={reporte?.filas || []}
          totales={reporte?.totales}
          cargando={cargando}
          vacio="No hay registros para los filtros elegidos."
          onFila={reporte?.filas?.some((f) => f.IDALUMNA) ? (f) => f.IDALUMNA && abrirEstadoCuenta(f.IDALUMNA) : undefined}
        />
        {reporte?.total > 0 && (
          <Pagination
            pagina={pagina}
            tamanio={tamanio}
            total={reporte.total}
            onChange={setPagina}
            tamanios={[10, 20, 30, 50]}
            onTamanioChange={(valor) => {
              setTamanio(valor);
              setPagina(1);
            }}
          />
        )}
      </section>
    </div>
  );
}
