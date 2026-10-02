import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots, faFileExcel, faFilePdf } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { abrirEstadoCuenta } from "../../utils/estadoCuenta";
import { exportarTabla } from "../../utils/reporteTabla";
import TablaGestion, { dinero } from "./TablaGestion";
import "../../styles/mantenedor.css";
import "./gestion.css";

function enlaceWhatsapp(numero) {
  const digitos = String(numero || "").replace(/\D/g, "");
  if (digitos.length < 9) return null;
  return `https://wa.me/${digitos.length === 9 ? `51${digitos}` : digitos}`;
}

function BotonWhatsapp({ numero }) {
  const enlace = enlaceWhatsapp(numero);
  if (!enlace) return numero || "—";
  return (
    <a
      className="btn-icon btn-icon--whatsapp"
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      title={`WhatsApp ${numero}`}
      onClick={(e) => e.stopPropagation()}
    >
      <FontAwesomeIcon icon={faCommentDots} />
    </a>
  );
}

function situacion(fila) {
  const clase = fila.SITUACION === "Vencida" ? "peligro" : fila.SITUACION === "En curso" ? "aviso" : "";
  const detalle = fila.SITUACION === "Vencida" ? ` hace ${Math.abs(fila.DIAS)} d` : "";
  return <span className={`gestion-chip ${clase ? `gestion-chip--${clase}` : ""}`}>{fila.SITUACION}{detalle}</span>;
}

const PESTANAS = {
  alumnas: {
    etiqueta: "Deuda por alumna",
    titulo: "Deuda total por alumna",
    columnas: [
      { key: "ALUMNA", label: "Alumna", formato: "texto" },
      { key: "CICLO", label: "Categoría", formato: "texto" },
      { key: "VENCIDAS", label: "Vencidas", formato: "entero" },
      { key: "MENSUALIDADES", label: "Mensualidades", formato: "moneda" },
      { key: "PRODUCTOS", label: "Productos", formato: "moneda" },
      { key: "SERVICIOS", label: "Servicios", formato: "moneda" },
      { key: "TOTAL", label: "Deuda total", formato: "moneda" },
    ],
    extra: [{ key: "TELAPODERADO", label: "Contacto", render: (f) => <BotonWhatsapp numero={f.TELAPODERADO} /> }],
  },
  mensualidades: {
    etiqueta: "Mensualidades con saldo",
    titulo: "Mensualidades vencidas y pendientes",
    columnas: [
      { key: "ALUMNA", label: "Alumna", formato: "texto" },
      { key: "CICLO", label: "Categoría", formato: "texto" },
      { key: "FECHAINICIO", label: "Inicio", formato: "fecha" },
      { key: "FECHAFIN", label: "Fin", formato: "fecha" },
      { key: "MONTO", label: "Monto", formato: "moneda" },
      { key: "PAGADO", label: "Pagado", formato: "moneda" },
      { key: "SALDO", label: "Saldo", formato: "moneda" },
      { key: "SITUACION", label: "Situación", formato: "texto" },
    ],
    render: { SITUACION: situacion },
    extra: [{ key: "TELAPODERADO", label: "Contacto", render: (f) => <BotonWhatsapp numero={f.TELAPODERADO} /> }],
  },
  proximas: {
    etiqueta: "Próximas a vencer",
    titulo: "Mensualidades próximas a vencer",
    columnas: [
      { key: "ALUMNA", label: "Alumna", formato: "texto" },
      { key: "CICLO", label: "Categoría", formato: "texto" },
      { key: "FECHAINICIO", label: "Inicio", formato: "fecha" },
      { key: "FECHAFIN", label: "Vence", formato: "fecha" },
      { key: "DIAS", label: "Días", formato: "entero" },
    ],
    render: {
      DIAS: (f) => (
        <span className={`gestion-chip ${f.DIAS <= 2 ? "gestion-chip--peligro" : "gestion-chip--aviso"}`}>
          {f.DIAS === 0 ? "Hoy" : `${f.DIAS} d`}
        </span>
      ),
    },
    extra: [{ key: "TELAPODERADO", label: "Contacto", render: (f) => <BotonWhatsapp numero={f.TELAPODERADO} /> }],
  },
  ventas: {
    etiqueta: "Productos y servicios",
    titulo: "Saldos pendientes de productos y servicios",
    columnas: [
      { key: "NUMERO", label: "Recibo", formato: "texto" },
      { key: "FECHA", label: "Fecha", formato: "fecha" },
      { key: "ALUMNA", label: "Alumna", formato: "texto" },
      { key: "TIPO", label: "Tipo", formato: "texto" },
      { key: "PRODUCTO", label: "Detalle", formato: "texto" },
      { key: "PRECIO", label: "Total", formato: "moneda" },
      { key: "PAGADO", label: "A cuenta", formato: "moneda" },
      { key: "SALDO", label: "Saldo", formato: "moneda" },
    ],
  },
};

export default function DeudasPage() {
  const [data, setData] = useState(null);
  const [dias, setDias] = useState(7);
  const [pestana, setPestana] = useState("alumnas");
  const [buscar, setBuscar] = useState("");
  const [ciclo, setCiclo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    (async () => {
      try {
        const res = await fetch(`/api/deudas/?dias=${dias}`);
        const body = await parseJsonResponse(res);
        if (!res.ok) throw new Error(body.error || "No se pudieron cargar las deudas");
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
  }, [dias]);

  const totales = data?.totales || {};
  const ciclos = useMemo(() => {
    const nombres = new Set();
    ["alumnas", "mensualidades", "proximas", "ventas"].forEach((k) => (data?.[k] || []).forEach((f) => f.CICLO && nombres.add(f.CICLO)));
    return [...nombres].sort();
  }, [data]);

  const config = PESTANAS[pestana];
  const filas = useMemo(() => {
    const texto = buscar.trim().toUpperCase();
    return (data?.[pestana] || []).filter((f) =>
      (!ciclo || f.CICLO === ciclo)
      && (!texto || String(f.ALUMNA || "").toUpperCase().includes(texto) || String(f.NUMERO || "").toUpperCase().includes(texto)));
  }, [data, pestana, buscar, ciclo]);

  const sumas = useMemo(() => {
    const resultado = {};
    config.columnas.forEach((col) => {
      if (col.formato === "moneda") resultado[col.key] = filas.reduce((s, f) => s + Number(f[col.key] || 0), 0);
    });
    return resultado;
  }, [filas, config]);

  const columnasTabla = [
    ...config.columnas.map((col) => (config.render?.[col.key] ? { ...col, render: config.render[col.key] } : col)),
    ...(config.extra || []),
  ];

  const exportar = (formato) => exportarTabla({
    titulo: config.titulo,
    metadatos: [
      ciclo ? `Categoría: ${ciclo}` : "Todas las categorías",
      pestana === "proximas" ? `Próximos ${dias} días` : null,
      `Total por cobrar: ${dinero(totales.porCobrar)}`,
    ].filter(Boolean),
    columnas: config.columnas,
    filas,
    totales: sumas,
    archivo: `Deudas-${pestana}`,
    formato,
  });

  const kpi = (clave, etiqueta, valor, detalle, tono = "") => (
    <button type="button" className={`gestion-kpi ${tono ? `gestion-kpi--${tono}` : ""} ${pestana === clave ? "is-activo" : ""}`} onClick={() => setPestana(clave)}>
      <p>{etiqueta}</p>
      <strong>{data ? valor : "—"}</strong>
      <small>{detalle}</small>
    </button>
  );

  return (
    <div className="mantenedor-page">
      <div className="page-header gestion-head">
        <h1>Deudas y vencimientos</h1>
      </div>

      {error && <p className="field-error">{error}</p>}

      <section className="gestion-kpis">
        {kpi("alumnas", "Total consolidado por cobrar", dinero(totales.porCobrar), `${totales.alumnas || 0} alumnas con saldo`, "peligro")}
        {kpi("mensualidades", "Mensualidades vencidas", totales.vencidas ?? 0, `${dinero(totales.montoVencido)} vencido · ${dinero(totales.mensualidades)} en total`, "aviso")}
        {kpi("proximas", "Próximas a vencer", totales.proximas ?? 0, `En los próximos ${dias} días`, "info")}
        {kpi("ventas", "Saldos de productos y servicios", dinero((totales.productos || 0) + (totales.servicios || 0)), `Productos ${dinero(totales.productos)} · Servicios ${dinero(totales.servicios)}`, "ok")}
      </section>

      <section className="mantenedor-card">
        <div className="gestion-tabs">
          {Object.entries(PESTANAS).map(([clave, p]) => (
            <button key={clave} type="button" className={`gestion-tab ${pestana === clave ? "is-activo" : ""}`} onClick={() => setPestana(clave)}>
              {p.etiqueta}<span>{(data?.[clave] || []).length}</span>
            </button>
          ))}
        </div>
        <div className="gestion-barra">
          <div className="gestion-filtros">
            <input type="search" placeholder="Buscar alumna o recibo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            <select value={ciclo} onChange={(e) => setCiclo(e.target.value)} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {ciclos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {pestana === "proximas" && (
              <select value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Días">
                {[3, 7, 15, 30].map((d) => <option key={d} value={d}>Próximos {d} días</option>)}
              </select>
            )}
          </div>
          <div className="toolbar-reporte-grupo">
            <button type="button" className="btn-primary toolbar-reporte" disabled={!filas.length} onClick={() => exportar("excel")}>
              <FontAwesomeIcon icon={faFileExcel} /> Excel
            </button>
            <button type="button" className="btn-secondary toolbar-reporte" disabled={!filas.length} onClick={() => exportar("pdf")}>
              <FontAwesomeIcon icon={faFilePdf} /> PDF
            </button>
          </div>
        </div>
        {pestana === "mensualidades" && (
          <p className="gestion-nota">
            Solo se cuentan periodos activos con saldo. Los periodos marcados como inactivos (la alumna no asistió) no generan deuda.
          </p>
        )}
        <TablaGestion
          columnas={columnasTabla}
          filas={filas}
          totales={sumas}
          cargando={cargando}
          vacio="No hay saldos pendientes con estos filtros."
          claveFila={(f, i) => `${f.IDMENSUALIDAD || f.IDVENTA || f.IDALUMNA || f.ALUMNA}-${i}`}
          onFila={(f) => f.IDALUMNA && abrirEstadoCuenta(f.IDALUMNA)}
        />
      </section>
    </div>
  );
}
