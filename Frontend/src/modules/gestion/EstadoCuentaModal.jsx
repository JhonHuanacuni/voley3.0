import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots, faFileExcel, faFilePdf, faXmark } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { dbToView } from "../../utils/fecha";
import { exportarTabla } from "../../utils/reporteTabla";
import TablaGestion, { dinero } from "./TablaGestion";
import "../../styles/mantenedor.css";
import "./gestion.css";

const TABLAS = { ALUMNA: "Matrícula / ficha", MENSUALIDAD: "Mensualidad", PAGO: "Pago", VENTA: "Venta" };
const TONOS = { Completada: "ok", Emitido: "ok", Activa: "ok", Parcial: "aviso", Inactivo: "aviso", Inactiva: "aviso", Deuda: "peligro", Anulado: "peligro", Retirada: "peligro" };

const chip = (texto) => (texto ? <span className={`gestion-chip ${TONOS[texto] ? `gestion-chip--${TONOS[texto]}` : ""}`}>{texto}</span> : "—");
const traza = (f) => (
  <span className="estado-cuenta-traza">
    {f.REGISTRADOPOR || "—"}
    {f.MODIFICADOPOR ? <><br />Modificado por: {f.MODIFICADOPOR}</> : null}
  </span>
);

function whatsapp(numero) {
  const digitos = String(numero || "").replace(/\D/g, "");
  if (digitos.length < 9) return null;
  return `https://wa.me/${digitos.length === 9 ? `51${digitos}` : digitos}`;
}

function pestanas(ocultarSaldos) {
  const saldo = ocultarSaldos ? [] : [{ key: "SALDO", label: "Saldo", formato: "moneda" }];
  return {
    mensualidades: {
      etiqueta: "Mensualidades",
      columnas: [
        { key: "FECHAINICIO", label: "Inicio", formato: "fecha" },
        { key: "FECHAFIN", label: "Fin", formato: "fecha" },
        { key: "MONTOREGULAR", label: "Tarifa regular", formato: "moneda" },
        { key: "MONTO", label: "Monto", formato: "moneda" },
        { key: "DESCUENTO", label: "Descuento", formato: "moneda" },
        { key: "PAGADO", label: "Pagado", formato: "moneda" },
        ...saldo,
        { key: "ESTADO", label: "Estado", formato: "texto", render: (f) => <>{chip(f.ESTADO)}{f.VENCIDA ? <> {chip("Vencida")}</> : null}</> },
        { key: "PROMOCION", label: "Promoción", formato: "texto" },
        { key: "REGISTRADOPOR", label: "Registrado por", formato: "texto", render: traza },
      ],
      sumar: ["MONTO", "DESCUENTO", "PAGADO", "SALDO"],
    },
    pagos: {
      etiqueta: "Pagos / recibos",
      columnas: [
        { key: "FECHA", label: "Fecha", formato: "fecha" },
        { key: "IDPAGO", label: "Recibo", formato: "texto" },
        { key: "PERIODO", label: "Periodo pagado", formato: "texto" },
        { key: "MONTO", label: "Monto", formato: "moneda" },
        { key: "MEDIO", label: "Medio", formato: "texto" },
        { key: "PARCIAL", label: "Tipo", formato: "texto", render: (f) => (f.PARCIAL ? chip("Parcial") : chip("Completada")) },
        { key: "REGISTRADOPOR", label: "Registrado por", formato: "texto", render: traza },
      ],
      sumar: ["MONTO"],
    },
    ventas: {
      etiqueta: "Ventas y clases",
      columnas: [
        { key: "FECHA", label: "Fecha", formato: "fecha" },
        { key: "NUMERO", label: "Recibo", formato: "texto" },
        { key: "TIPO", label: "Tipo", formato: "texto", render: (f) => (f.CLASE ? "Clase individual" : f.TIPO) },
        { key: "PRODUCTO", label: "Detalle", formato: "texto" },
        { key: "PRECIO", label: "Total", formato: "moneda" },
        { key: "PAGADO", label: "Pagado", formato: "moneda" },
        ...saldo,
        { key: "MEDIO", label: "Medio", formato: "texto" },
        { key: "ESTADO_RECIBO", label: "Estado", formato: "texto", render: (f) => chip(f.ESTADO_RECIBO) },
        { key: "REGISTRADOPOR", label: "Registrado por", formato: "texto", render: traza },
      ],
      sumar: ["PRECIO", "PAGADO", "SALDO"],
      soloEmitidos: true,
    },
    abonos: {
      etiqueta: "Abonos",
      columnas: [
        { key: "FECHA", label: "Fecha", formato: "fecha" },
        { key: "NUMERO", label: "Recibo", formato: "texto" },
        { key: "PRODUCTO", label: "Detalle", formato: "texto" },
        { key: "PRECIO", label: "Total venta", formato: "moneda" },
        { key: "ORIGEN", label: "Tipo", formato: "texto", render: (f) => (f.ORIGEN === "Abono" ? chip("Abono") : f.ORIGEN) },
        { key: "MONTO", label: "Monto", formato: "moneda" },
        { key: "MEDIO", label: "Medio", formato: "texto" },
        ...(ocultarSaldos ? [] : [{ key: "SALDO", label: "Saldo actual", formato: "moneda" }]),
        { key: "REGISTRADOPOR", label: "Registrado por", formato: "texto", render: traza },
      ],
      sumar: ["MONTO"],
    },
    productos: {
      etiqueta: "Productos adquiridos",
      columnas: [
        { key: "FECHA", label: "Fecha", formato: "fecha" },
        { key: "NUMERO", label: "Recibo", formato: "texto" },
        { key: "PRODUCTO", label: "Producto", formato: "texto" },
        { key: "TALLA", label: "Talla", formato: "texto" },
        { key: "PRECIO", label: "Precio", formato: "moneda" },
      ],
      sumar: ["PRECIO"],
    },
    historial: {
      etiqueta: "Historial",
      columnas: [
        { key: "FECHA", label: "Fecha", formato: "fecha" },
        { key: "HORA", label: "Hora", formato: "texto", render: (f) => String(f.HORA || "").slice(0, 5) || "—" },
        { key: "IDUSUARIO", label: "Usuario", formato: "texto" },
        { key: "TABLA", label: "Módulo", formato: "texto", render: (f) => TABLAS[f.TABLA] || f.TABLA },
        { key: "IDREGISTRO", label: "Código", formato: "texto" },
        { key: "ACCION", label: "Acción", formato: "texto" },
        { key: "DETALLE", label: "Detalle", formato: "texto" },
      ],
    },
  };
}

const DATOS = [
  ["IDALUMNA", "Código"],
  ["DNI", "DNI"],
  ["FECHANACIMIENTO", "Fecha de nacimiento", "fecha"],
  ["CICLO", "Categoría"],
  ["TURNO", "Turno"],
  ["ESTADO", "Estado"],
  ["TELEFONO", "Teléfono"],
  ["EMAIL", "Correo"],
  ["DIRECCION", "Dirección"],
  ["APODERADO", "Apoderado"],
  ["DNIAPODERADO", "DNI apoderado"],
  ["TELAPODERADO", "Tel. apoderado"],
  ["FECHAINSCRIPCION", "Fecha de inscripción", "fecha"],
  ["INICIOMENSUALIDAD", "Inicio mensualidad vigente", "fecha"],
  ["FINMENSUALIDAD", "Fin mensualidad vigente", "fecha"],
  ["FECHARETIRO", "Fecha de retiro", "fecha"],
  ["MOTIVORETIRO", "Motivo de retiro"],
  ["MATRICULADOPOR", "Matriculado por"],
  ["MODIFICADOPOR", "Modificado por"],
];

export default function EstadoCuentaModal({ idAlumna, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pestana, setPestana] = useState("datos");

  useEffect(() => {
    let vigente = true;
    setData(null);
    setError("");
    setPestana("datos");
    (async () => {
      try {
        const res = await fetch(`/api/estado-cuenta/${encodeURIComponent(idAlumna)}/`);
        const body = await parseJsonResponse(res);
        if (!res.ok) throw new Error(body.error || "No se pudo cargar el estado de cuenta");
        if (vigente) setData(body.data);
      } catch (err) {
        if (vigente) setError(err.message);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [idAlumna]);

  useEffect(() => {
    const alTeclear = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onClose]);

  const ocultarSaldos = Boolean(data?.ocultarSaldos);
  const config = useMemo(() => pestanas(ocultarSaldos), [ocultarSaldos]);
  const alumna = data?.alumna || {};
  const resumen = data?.resumen || {};
  const actual = config[pestana];
  const filas = actual ? data?.[pestana] || [] : [];

  const totales = useMemo(() => {
    if (!actual?.sumar) return {};
    const base = actual.soloEmitidos ? filas.filter((f) => f.ESTADO_RECIBO === "Emitido") : filas;
    const visibles = new Set(actual.columnas.map((c) => c.key));
    return Object.fromEntries(actual.sumar.filter((k) => visibles.has(k)).map((k) => [k, base.reduce((s, f) => s + Number(f[k] || 0), 0)]));
  }, [actual, filas]);

  const exportar = (formato) => exportarTabla({
    titulo: `Estado de cuenta - ${actual.etiqueta}`,
    metadatos: [
      `Alumna: ${alumna.NOMBRE}`,
      alumna.DNI ? `DNI: ${alumna.DNI}` : null,
      alumna.CICLO ? `Categoría: ${alumna.CICLO}` : null,
      ocultarSaldos ? null : `Deuda total: ${dinero(resumen.deudaTotal)}`,
    ].filter(Boolean),
    columnas: actual.columnas.map(({ key, label, formato: f }) => ({ key, label, formato: f })),
    filas: pestana === "historial"
      ? filas.map((f) => ({ ...f, TABLA: TABLAS[f.TABLA] || f.TABLA }))
      : filas,
    totales,
    archivo: `EstadoCuenta-${alumna.IDALUMNA}-${pestana}`,
    formato,
  });

  const enlace = whatsapp(alumna.TELAPODERADO || alumna.TELEFONO);

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel estado-cuenta-panel" role="dialog" aria-modal="true" aria-label="Estado de cuenta">
        <div className="estado-cuenta-head">
          <div>
            <h2>{data ? alumna.NOMBRE : "Estado de cuenta"}</h2>
            {data && (
              <p>
                {chip(alumna.ESTADO)} {alumna.CICLO || "Sin categoría"}{alumna.TURNO ? ` · ${alumna.TURNO}` : ""}
                {alumna.MATRICULADOPOR ? ` · Matriculado por: ${alumna.MATRICULADOPOR}` : ""}
                {alumna.MODIFICADOPOR ? ` · Modificado por: ${alumna.MODIFICADOPOR}` : ""}
              </p>
            )}
          </div>
          <div className="toolbar-reporte-grupo">
            {enlace && (
              <a className="btn-icon btn-icon--whatsapp" href={enlace} target="_blank" rel="noopener noreferrer" title="WhatsApp del apoderado">
                <FontAwesomeIcon icon={faCommentDots} />
              </a>
            )}
            <button type="button" className="estado-cuenta-cerrar" onClick={onClose} aria-label="Cerrar">
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}
        {!data && !error && <p className="gestion-vacio">Cargando estado de cuenta…</p>}

        {data && (
          <div className="estado-cuenta-cuerpo">
            <section className="gestion-kpis">
              {!ocultarSaldos && (
                <div className={`gestion-kpi ${resumen.deudaTotal > 0 ? "gestion-kpi--peligro" : "gestion-kpi--ok"}`}>
                  <p>Deuda total</p>
                  <strong>{dinero(resumen.deudaTotal)}</strong>
                  <small>Mensualidades {dinero(resumen.saldoMensualidades)} · Ventas {dinero(resumen.saldoVentas)}</small>
                </div>
              )}
              <div className="gestion-kpi gestion-kpi--ok">
                <p>Mensualidades pagadas</p>
                <strong>{resumen.pagadas ?? 0}</strong>
                <small>Total pagado {dinero(resumen.totalPagado)}</small>
              </div>
              <div className={`gestion-kpi ${resumen.vencidas ? "gestion-kpi--peligro" : "gestion-kpi--aviso"}`}>
                <p>Pendientes</p>
                <strong>{resumen.pendientes ?? 0}</strong>
                <small>{resumen.vencidas ? `${resumen.vencidas} vencida(s)` : "Sin vencidas"}</small>
              </div>
              <div className="gestion-kpi gestion-kpi--info">
                <p>Descuentos por promoción</p>
                <strong>{dinero(resumen.descuentos)}</strong>
                <small>No se consideran deuda</small>
              </div>
            </section>

            <div className="gestion-tabs">
              <button type="button" className={`gestion-tab ${pestana === "datos" ? "is-activo" : ""}`} onClick={() => setPestana("datos")}>
                Datos personales
              </button>
              {Object.entries(config).map(([clave, p]) => (
                <button key={clave} type="button" className={`gestion-tab ${pestana === clave ? "is-activo" : ""}`} onClick={() => setPestana(clave)}>
                  {p.etiqueta}<span>{(data[clave] || []).length}</span>
                </button>
              ))}
            </div>

            {pestana === "datos" ? (
              <dl className="estado-cuenta-datos">
                {DATOS.filter(([clave]) => alumna[clave] != null && alumna[clave] !== "").map(([clave, etiqueta, formato]) => (
                  <div key={clave}>
                    <dt>{etiqueta}</dt>
                    <dd>{formato === "fecha" ? dbToView(String(alumna[clave])) : String(alumna[clave])}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <>
                <div className="gestion-barra">
                  <p>{actual.etiqueta} · {filas.length} registros</p>
                  <div className="toolbar-reporte-grupo">
                    <button type="button" className="btn-primary toolbar-reporte" disabled={!filas.length} onClick={() => exportar("excel")}>
                      <FontAwesomeIcon icon={faFileExcel} /> Excel
                    </button>
                    <button type="button" className="btn-secondary toolbar-reporte" disabled={!filas.length} onClick={() => exportar("pdf")}>
                      <FontAwesomeIcon icon={faFilePdf} /> PDF
                    </button>
                  </div>
                </div>
                {pestana === "ventas" && <p className="gestion-nota">Los totales solo consideran recibos emitidos.</p>}
                <TablaGestion
                  columnas={actual.columnas}
                  filas={filas}
                  totales={totales}
                  vacio="Sin registros."
                  claveFila={(f, i) => `${f.IDABONO || f.IDMENSUALIDAD || f.IDPAGO || f.IDVENTA || f.IDAUDITORIA || ""}-${i}`}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
