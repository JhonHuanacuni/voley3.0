import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots, faFileExcel, faFilePdf, faXmark } from "@fortawesome/free-solid-svg-icons";
import Pagination from "../../components/mantenedor/Pagination";
import { parseJsonResponse } from "../../utils/api";
import { dbToView } from "../../utils/fecha";
import { exportarTabla } from "../../utils/reporteTabla";
import TablaGestion from "./TablaGestion";
import { dinero, siguienteOrden } from "./tablaGestionUtils";
import "../../styles/mantenedor.css";
import "./gestion.css";

const TONOS = { Completada: "ok", Emitido: "ok", Activa: "ok", Parcial: "aviso", Inactivo: "aviso", Inactiva: "aviso", Deuda: "peligro", Anulado: "peligro", Retirada: "peligro" };

const chip = (texto) => (texto ? <span className={`gestion-chip ${TONOS[texto] ? `gestion-chip--${TONOS[texto]}` : ""}`}>{texto}</span> : "—");

const ESTADOS_MENSUALIDAD = [
  { value: "pagadas", label: "SOLO PAGADAS" },
  { value: "pendientes", label: "SOLO PENDIENTES" },
];
const SIN_DATOS = { filas: [], totales: {}, total: 0 };

async function pedirSeccion(idAlumna, seccion, extras) {
  const params = new URLSearchParams();
  Object.entries(extras).forEach(([clave, valor]) => {
    if (valor != null && valor !== "") params.set(clave, String(valor));
  });
  const res = await fetch(`/api/estado-cuenta/${encodeURIComponent(idAlumna)}/${seccion}/?${params}`);
  const body = await parseJsonResponse(res);
  if (!res.ok) throw new Error(body.error || "No se pudo cargar la pestaña");
  return body.data;
}

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
      ],
    },
    pagos: {
      etiqueta: "Pagos / recibos",
      columnas: [
        { key: "FECHA", label: "Fecha", formato: "fecha" },
        { key: "IDPAGO", label: "Recibo", formato: "texto" },
        { key: "PERIODO", label: "Periodo pagado", formato: "texto", campoOrden: "FECHAPERIODO" },
        { key: "MONTO", label: "Monto", formato: "moneda" },
        { key: "MEDIO", label: "Medio", formato: "texto" },
        { key: "PARCIAL", label: "Tipo", formato: "texto", render: (f) => (f.PARCIAL ? chip("Parcial") : chip("Completada")) },
      ],
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
      ],
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
      ],
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
  const [orden, setOrden] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [tamanio, setTamanio] = useState(10);
  const [estadoMensualidad, setEstadoMensualidad] = useState("");
  const [resultado, setResultado] = useState({ clave: "", datos: SIN_DATOS });
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let vigente = true;
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

  const ordenarPor = orden?.campo || "";
  const direccion = orden?.direccion || "";
  const estado = pestana === "mensualidades" ? estadoMensualidad : "";
  const claveActual = `${idAlumna}|${pestana}|${estado}|${pagina}|${tamanio}|${ordenarPor}|${direccion}`;

  useEffect(() => {
    if (!data || !config[pestana]) return undefined;
    let vigente = true;
    const clave = `${idAlumna}|${pestana}|${estado}|${pagina}|${tamanio}|${ordenarPor}|${direccion}`;
    pedirSeccion(idAlumna, pestana, { estado, pagina, tamanio, ordenarPor, direccion })
      .then((datos) => {
        if (!vigente) return;
        setError("");
        setResultado({ clave, datos: datos || SIN_DATOS });
      })
      .catch((err) => {
        if (!vigente) return;
        setError(err.message);
        setResultado({ clave, datos: SIN_DATOS });
      });
    return () => {
      vigente = false;
    };
  }, [data, config, idAlumna, pestana, estado, pagina, tamanio, ordenarPor, direccion]);

  const cargando = resultado.clave !== claveActual;
  const datos = cargando ? SIN_DATOS : resultado.datos;
  const filas = datos.filas || [];

  const cambiarPestana = (clave) => {
    setPestana(clave);
    setOrden(null);
    setPagina(1);
  };

  const ordenar = (campo) => {
    setOrden((previo) => siguienteOrden(previo, campo));
    setPagina(1);
  };

  const exportar = async (formato) => {
    setExportando(true);
    try {
      const completo = await pedirSeccion(idAlumna, pestana, { estado, todo: 1, ordenarPor, direccion });
      const todas = completo.filas || [];
      await exportarTabla({
        titulo: `Estado de cuenta - ${actual.etiqueta}`,
        metadatos: [
          `Alumna: ${String(alumna.NOMBRE || "").toUpperCase()}`,
          alumna.DNI ? `DNI: ${alumna.DNI}` : null,
          alumna.CICLO ? `Categoría: ${alumna.CICLO}` : null,
          estado ? `Estado: ${ESTADOS_MENSUALIDAD.find((e) => e.value === estado)?.label}` : null,
          ocultarSaldos ? null : `Deuda total: ${dinero(resumen.deudaTotal)}`,
        ].filter(Boolean),
        columnas: actual.columnas.map(({ key, label, formato: f }) => ({ key, label, formato: f })),
        filas: todas,
        totales: completo.totales || {},
        archivo: `EstadoCuenta-${alumna.IDALUMNA}-${pestana}`,
        formato,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setExportando(false);
    }
  };

  const enlace = whatsapp(alumna.TELAPODERADO || alumna.TELEFONO);

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel estado-cuenta-panel" role="dialog" aria-modal="true" aria-label="Estado de cuenta">
        <div className="estado-cuenta-head">
          <div>
            <h2>{data ? String(alumna.NOMBRE || "").toUpperCase() : "Estado de cuenta"}</h2>
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
                </div>
              )}
              <div className="gestion-kpi gestion-kpi--ok">
                <p>Mensualidades pagadas</p>
                <strong>{resumen.pagadas ?? 0}</strong>
              </div>
              <div className={`gestion-kpi ${resumen.vencidas ? "gestion-kpi--peligro" : "gestion-kpi--aviso"}`}>
                <p>Pendientes</p>
                <strong>{resumen.pendientes ?? 0}</strong>
              </div>
              <div className="gestion-kpi gestion-kpi--info">
                <p>Descuentos por promoción</p>
                <strong>{dinero(resumen.descuentos)}</strong>
              </div>
            </section>

            <div className="gestion-tabs">
              <button type="button" className={`gestion-tab ${pestana === "datos" ? "is-activo" : ""}`} onClick={() => cambiarPestana("datos")}>
                Datos personales
              </button>
              {Object.entries(config).map(([clave, p]) => (
                <button key={clave} type="button" className={`gestion-tab ${pestana === clave ? "is-activo" : ""}`} onClick={() => cambiarPestana(clave)}>
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
                  <div className="gestion-filtros">
                    <p>{actual.etiqueta} · {cargando ? "…" : datos.total} registros</p>
                    {pestana === "mensualidades" && (
                      <select
                        value={estadoMensualidad}
                        onChange={(e) => {
                          setEstadoMensualidad(e.target.value);
                          setPagina(1);
                        }}
                        aria-label="Estado de la mensualidad"
                      >
                        <option value="">PAGADAS Y PENDIENTES</option>
                        {ESTADOS_MENSUALIDAD.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="toolbar-reporte-grupo">
                    <button type="button" className="btn-primary toolbar-reporte" disabled={!datos.total || exportando} onClick={() => exportar("excel")}>
                      <FontAwesomeIcon icon={faFileExcel} /> Excel
                    </button>
                    <button type="button" className="btn-secondary toolbar-reporte" disabled={!datos.total || exportando} onClick={() => exportar("pdf")}>
                      <FontAwesomeIcon icon={faFilePdf} /> PDF
                    </button>
                  </div>
                </div>
                {pestana === "ventas" && <p className="gestion-nota">Los totales solo consideran recibos emitidos.</p>}
                <TablaGestion
                  paginada
                  orden={orden}
                  onOrdenar={ordenar}
                  columnas={actual.columnas}
                  filas={filas}
                  totales={datos.totales}
                  cargando={cargando}
                  vacio="Sin registros."
                  claveFila={(f, i) => `${f.IDABONO || f.IDMENSUALIDAD || f.IDPAGO || f.IDVENTA || ""}-${i}`}
                />
                {datos.total > 0 && (
                  <Pagination
                    pagina={pagina}
                    tamanio={tamanio}
                    total={datos.total}
                    onChange={setPagina}
                    tamanios={[10, 20, 30, 50]}
                    onTamanioChange={(valor) => {
                      setTamanio(valor);
                      setPagina(1);
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
