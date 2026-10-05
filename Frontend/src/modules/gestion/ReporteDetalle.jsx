import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel, faFilePdf } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { dbToView, hoyInput, inputToDb, primerDiaMesInput } from "../../utils/fecha";
import { exportarTabla } from "../../utils/reporteTabla";
import { abrirEstadoCuenta } from "../../utils/estadoCuenta";
import Pagination from "../../components/mantenedor/Pagination";
import TablaGestion from "./TablaGestion";
import { dinero, siguienteOrden } from "./tablaGestionUtils";
import { PESTANAS_DETALLE } from "./reportesDetalle";

const ESTADOS_ALUMNA = [
  { value: "Activa", label: "ACTIVAS" },
  { value: "Inactiva", label: "INACTIVAS" },
  { value: "Retirada", label: "RETIRADAS" },
];

const TIPOS_PAGO = [
  { value: "mensualidades", label: "SOLO MENSUALIDADES" },
  { value: "ventas", label: "SOLO VENTAS Y ABONOS" },
];

const TONOS = {
  Activa: "ok",
  Completada: "ok",
  Pagado: "ok",
  Deuda: "peligro",
  Retirada: "peligro",
  Parcial: "aviso",
  Inactiva: "aviso",
  Inactivo: "aviso",
  "Con saldo": "aviso",
};

const KPIS_FINANZAS = [
  { key: "MESANTERIOR", label: "Saldo del mes anterior", tono: "info" },
  { key: "PAGOS", label: "Mensualidades cobradas", tono: "ok" },
  { key: "VENTAS", label: "Ventas cobradas", tono: "ok" },
  { key: "INGRESOS", label: "Ingresos del mes", tono: "ok" },
  { key: "EGRESOS", label: "Egresos del mes", tono: "peligro" },
  { key: "UTILIDAD", label: "Utilidad", tono: "info" },
];

function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

const filtrosIniciales = () => ({
  mes: mesActual(),
  estado: "",
  idciclo: "",
  idturno: "",
  tipo: "",
  desde: primerDiaMesInput(),
  hasta: hoyInput(),
});

function paramsReporte(tipo, filtros, buscar, extras = {}) {
  const usa = PESTANAS_DETALLE[tipo].filtros;
  const params = new URLSearchParams();
  if (usa.includes("mes") && filtros.mes) params.set("mes", filtros.mes);
  if (usa.includes("buscar") && buscar) params.set("buscar", buscar);
  if (usa.includes("estado") && filtros.estado) params.set("estado", filtros.estado);
  if (usa.includes("ciclo") && filtros.idciclo) params.set("idciclo", filtros.idciclo);
  if (usa.includes("turno") && filtros.idturno) params.set("idturno", filtros.idturno);
  if (usa.includes("tipo") && filtros.tipo) params.set("tipo", filtros.tipo);
  if (usa.includes("desde")) {
    if (filtros.desde) params.set("desde", filtros.desde);
    if (filtros.hasta) params.set("hasta", filtros.hasta);
  }
  Object.entries(extras).forEach(([clave, valor]) => {
    if (valor != null && valor !== "") params.set(clave, String(valor));
  });
  return params;
}

async function pedirReporte(tipo, params) {
  const res = await fetch(`/api/reportes-detalle/${tipo}/?${params}`);
  const body = await parseJsonResponse(res);
  if (!res.ok) throw new Error(body.error || body.mensaje || "No se pudo generar el reporte");
  return body.data;
}

function chip(valor, tono) {
  if (!valor) return "—";
  return <span className={`gestion-chip ${tono ? `gestion-chip--${tono}` : ""}`}>{String(valor).toUpperCase()}</span>;
}

function columnaEnPantalla(col) {
  if (col.dia) {
    return {
      ...col,
      className: `asistencia-dia ${col.domingo ? "asistencia-dia--domingo" : ""}`,
      render: (fila) => {
        const marca = fila[col.key];
        return marca ? <span className={`asistencia-marca asistencia-marca--${marca}`}>{marca}</span> : "";
      },
    };
  }
  if (col.key === "ESTADO") return { ...col, render: (fila) => chip(fila.ESTADO, TONOS[fila.ESTADO]) };
  if (col.key === "PAGO") return { ...col, className: "asistencia-pago", render: (fila) => chip(fila.PAGO, fila.PAGOTONO) };
  return col;
}

export default function ReporteDetalle({ tipo }) {
  const config = PESTANAS_DETALLE[tipo];
  const usa = (filtro) => config.filtros.includes(filtro);
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [buscar, setBuscar] = useState("");
  const [buscarAplicado, setBuscarAplicado] = useState("");
  const [catalogos, setCatalogos] = useState({ ciclos: [], turnos: [] });
  const [pagina, setPagina] = useState(1);
  const [tamanio, setTamanio] = useState(10);
  const [orden, setOrden] = useState(null);
  const [resultado, setResultado] = useState({ clave: "", reporte: null });
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/catalogos/");
        const body = await parseJsonResponse(res);
        if (res.ok) setCatalogos({ ciclos: body.data?.ciclos || [], turnos: body.data?.turnos || [] });
      } catch {
        /* sin catálogos los filtros de categoría y turno quedan vacíos */
      }
    })();
  }, []);

  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscarAplicado(buscar.trim());
      setPagina(1);
    }, 350);
    return () => clearTimeout(espera);
  }, [buscar]);

  const ordenarPor = orden?.campo || "";
  const direccion = orden?.direccion || "";
  const claveActual = [JSON.stringify(filtros), buscarAplicado, pagina, tamanio, ordenarPor, direccion].join("|");

  useEffect(() => {
    let vigente = true;
    const clave = [JSON.stringify(filtros), buscarAplicado, pagina, tamanio, ordenarPor, direccion].join("|");
    pedirReporte(tipo, paramsReporte(tipo, filtros, buscarAplicado, { pagina, tamanio, ordenarPor, direccion }))
      .then((data) => {
        if (!vigente) return;
        setError("");
        setResultado({ clave, reporte: data });
      })
      .catch((err) => {
        if (!vigente) return;
        setError(err.message);
        setResultado({ clave, reporte: null });
      });
    return () => {
      vigente = false;
    };
  }, [tipo, filtros, buscarAplicado, pagina, tamanio, ordenarPor, direccion]);

  const cargando = resultado.clave !== claveActual;
  const reporte = resultado.reporte;

  const cambiarFiltro = (clave) => (valor) => {
    setFiltros((actual) => ({ ...actual, [clave]: valor }));
    setPagina(1);
  };

  const ordenar = (campo) => {
    setOrden((actual) => siguienteOrden(actual, campo));
    setPagina(1);
  };

  const etiqueta = (lista, valor) => lista.find((op) => op.value === valor)?.label || valor;

  const metadatos = (datos) => [
    usa("desde") && filtros.desde && filtros.hasta
      ? `Del ${dbToView(inputToDb(filtros.desde))} al ${dbToView(inputToDb(filtros.hasta))}`
      : null,
    usa("estado") ? (filtros.estado ? `Estado: ${etiqueta(ESTADOS_ALUMNA, filtros.estado)}` : "Todos los estados") : null,
    usa("tipo") && filtros.tipo ? `Tipo: ${etiqueta(TIPOS_PAGO, filtros.tipo)}` : null,
    usa("ciclo") ? (filtros.idciclo ? `Categoría: ${etiqueta(catalogos.ciclos, filtros.idciclo)}` : "Todas las categorías") : null,
    usa("turno") && filtros.idturno ? `Turno: ${etiqueta(catalogos.turnos, filtros.idturno)}` : null,
    usa("buscar") && buscarAplicado ? `Búsqueda: ${buscarAplicado.toUpperCase()}` : null,
    ...(datos?.resumen ? KPIS_FINANZAS.map((k) => `${k.label}: ${dinero(datos.resumen[k.key])}`) : []),
  ].filter(Boolean);

  const exportar = async (formato) => {
    setExportando(true);
    try {
      const completo = await pedirReporte(tipo, paramsReporte(tipo, filtros, buscarAplicado, { todo: 1, ordenarPor, direccion }));
      await exportarTabla({
        titulo: completo.titulo,
        metadatos: metadatos(completo),
        columnas: formato === "pdf" ? completo.columnas.filter((c) => !c.soloExportar) : completo.columnas,
        filas: completo.filas || [],
        totales: completo.totales || {},
        archivo: `${config.archivo}-${completo.mes || inputToDb(filtros.hasta) || ""}`,
        formato,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setExportando(false);
    }
  };

  const columnas = (reporte?.columnas || []).filter((col) => !col.soloExportar).map(columnaEnPantalla);
  const resumen = tipo === "ingresos-egresos" ? reporte?.resumen : null;

  return (
    <>
      <div className="gestion-barra">
        <div className="gestion-filtros">
          {usa("mes") && (
            <label>
              Mes
              <input type="month" value={filtros.mes} onChange={(e) => cambiarFiltro("mes")(e.target.value)} />
            </label>
          )}
          {usa("buscar") && (
            <label>
              Buscar
              <input
                type="search"
                placeholder={tipo === "historial-pagos" ? "Alumna, DNI o N.° de recibo" : "Nombre, DNI o código"}
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
              />
            </label>
          )}
          {usa("estado") && (
            <label>
              Estado
              <select value={filtros.estado} onChange={(e) => cambiarFiltro("estado")(e.target.value)}>
                <option value="">TODOS LOS ESTADOS</option>
                {ESTADOS_ALUMNA.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
              </select>
            </label>
          )}
          {usa("tipo") && (
            <label>
              Tipo
              <select value={filtros.tipo} onChange={(e) => cambiarFiltro("tipo")(e.target.value)}>
                <option value="">MENSUALIDADES Y VENTAS</option>
                {TIPOS_PAGO.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
              </select>
            </label>
          )}
          {usa("desde") && (
            <>
              <label>
                Desde
                <input
                  type="date"
                  value={filtros.desde}
                  max={filtros.hasta || undefined}
                  onChange={(e) => cambiarFiltro("desde")(e.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={filtros.hasta}
                  min={filtros.desde || undefined}
                  onChange={(e) => cambiarFiltro("hasta")(e.target.value)}
                />
              </label>
            </>
          )}
          {usa("ciclo") && (
            <label>
              Categoría
              <select value={filtros.idciclo} onChange={(e) => cambiarFiltro("idciclo")(e.target.value)}>
                <option value="">TODAS LAS CATEGORÍAS</option>
                {catalogos.ciclos.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
          )}
          {usa("turno") && (
            <label>
              Turno
              <select value={filtros.idturno} onChange={(e) => cambiarFiltro("idturno")(e.target.value)}>
                <option value="">TODOS LOS TURNOS</option>
                {catalogos.turnos.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="toolbar-reporte-grupo">
          <button
            type="button"
            className="btn-primary toolbar-reporte"
            disabled={!reporte?.total || exportando}
            onClick={() => exportar("excel")}
          >
            <FontAwesomeIcon icon={faFileExcel} /> Excel
          </button>
          <button
            type="button"
            className="btn-secondary toolbar-reporte"
            disabled={!reporte?.total || exportando}
            onClick={() => exportar("pdf")}
          >
            <FontAwesomeIcon icon={faFilePdf} /> PDF
          </button>
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}

      {resumen && (
        <div className="gestion-kpis reporte-detalle-kpis">
          {KPIS_FINANZAS.map((k) => {
            const negativo = Number(resumen[k.key]) < 0;
            return (
              <div key={k.key} className={`gestion-kpi gestion-kpi--${negativo ? "peligro" : k.tono}`}>
                <p>{k.label}</p>
                <strong>{dinero(resumen[k.key])}</strong>
              </div>
            );
          })}
        </div>
      )}

      {reporte && (
        <p className="gestion-nota">
          <strong>{reporte.titulo}</strong> · {reporte.total} registros
          {metadatos(null).length > 0 && ` · ${metadatos(null).join(" · ")}`}
          {config.nota && ` · ${config.nota}`}
          {resumen && " · Utilidad = saldo del mes anterior + ingresos − egresos"}
        </p>
      )}

      <TablaGestion
        paginada
        className={tipo === "asistencia-mensual" ? "reporte-asistencia" : ""}
        orden={orden}
        onOrdenar={ordenar}
        columnas={columnas}
        filas={reporte?.filas || []}
        totales={reporte?.totales}
        cargando={cargando}
        vacio={tipo === "ingresos-egresos" ? "No hay egresos registrados en este mes." : "No hay registros para los filtros elegidos."}
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
    </>
  );
}
