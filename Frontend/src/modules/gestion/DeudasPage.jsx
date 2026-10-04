import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots, faFileExcel, faFilePdf } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { abrirEstadoCuenta } from "../../utils/estadoCuenta";
import { exportarTabla } from "../../utils/reporteTabla";
import Pagination from "../../components/mantenedor/Pagination";
import TablaGestion from "./TablaGestion";
import { dinero, siguienteOrden } from "./tablaGestionUtils";
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
    etiqueta: "Mensualidades con deuda",
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
    etiqueta: "Saldos pendientes de productos y servicios",
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

const TOTAL_PESTANA = {
  alumnas: "alumnas",
  mensualidades: "mensualidadesConSaldo",
  proximas: "proximas",
  ventas: "ventas",
};

const SIN_DATOS = { filas: [], totales: {}, total: 0 };
const TIPOS_VENTA = [
  { value: "Producto físico", label: "SOLO PRODUCTOS" },
  { value: "Servicio", label: "SOLO SERVICIOS" },
];

async function pedirDeudas(seccion, dias, buscar, ciclo, extras = {}) {
  const params = new URLSearchParams({ seccion, dias: String(dias) });
  if (buscar) params.set("buscar", buscar);
  if (ciclo) params.set("idciclo", ciclo);
  Object.entries(extras).forEach(([clave, valor]) => {
    if (valor != null && valor !== "") params.set(clave, String(valor));
  });
  const res = await fetch(`/api/deudas/?${params}`);
  const body = await parseJsonResponse(res);
  if (!res.ok) throw new Error(body.error || "No se pudieron cargar las deudas");
  return body.data;
}

export default function DeudasPage() {
  const [resultado, setResultado] = useState({ clave: "", datos: SIN_DATOS });
  const [totales, setTotales] = useState({});
  const [dias, setDias] = useState(7);
  const [pestana, setPestana] = useState("alumnas");
  const [buscar, setBuscar] = useState("");
  const [buscarAplicado, setBuscarAplicado] = useState("");
  const [ciclo, setCiclo] = useState("");
  const [ciclos, setCiclos] = useState([]);
  const [tipoVenta, setTipoVenta] = useState("");
  const [pagina, setPagina] = useState(1);
  const [tamanio, setTamanio] = useState(10);
  const [orden, setOrden] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/catalogos/");
        const body = await parseJsonResponse(res);
        if (res.ok) setCiclos(body.data?.ciclos || []);
      } catch {
        /* sin catálogo el filtro de categoría queda vacío */
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

  useEffect(() => {
    let vigente = true;
    pedirDeudas("conteo", dias, buscarAplicado, ciclo)
      .then((data) => vigente && setTotales(data || {}))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [dias, buscarAplicado, ciclo]);

  const ordenarPor = orden?.campo || "";
  const direccion = orden?.direccion || "";
  const tipo = pestana === "ventas" ? tipoVenta : "";
  const claveActual = `${pestana}|${dias}|${buscarAplicado}|${ciclo}|${tipo}|${pagina}|${tamanio}|${ordenarPor}|${direccion}`;

  useEffect(() => {
    let vigente = true;
    const clave = `${pestana}|${dias}|${buscarAplicado}|${ciclo}|${tipo}|${pagina}|${tamanio}|${ordenarPor}|${direccion}`;
    pedirDeudas(pestana, dias, buscarAplicado, ciclo, { tipo, pagina, tamanio, ordenarPor, direccion })
      .then((data) => {
        if (!vigente) return;
        setError("");
        setResultado({ clave, datos: data || SIN_DATOS });
      })
      .catch((err) => {
        if (!vigente) return;
        setError(err.message);
        setResultado({ clave, datos: SIN_DATOS });
      });
    return () => {
      vigente = false;
    };
  }, [pestana, dias, buscarAplicado, ciclo, tipo, pagina, tamanio, ordenarPor, direccion]);

  const nombreCiclo = ciclos.find((c) => c.value === ciclo)?.label;

  const config = PESTANAS[pestana];
  const cargando = resultado.clave !== claveActual;
  const datos = cargando ? SIN_DATOS : resultado.datos;
  const filas = useMemo(() => datos.filas || [], [datos]);

  const cambiarFiltro = (setter) => (valor) => {
    setter(valor);
    setPagina(1);
  };

  const cambiarPestana = (clave) => {
    setPestana(clave);
    setOrden(null);
    setPagina(1);
  };

  const ordenar = (campo) => {
    setOrden((actual) => siguienteOrden(actual, campo));
    setPagina(1);
  };

  const columnasTabla = [
    ...config.columnas.map((col) => (config.render?.[col.key] ? { ...col, render: config.render[col.key] } : col)),
    ...(config.extra || []),
  ];

  const exportar = async (formato) => {
    setExportando(true);
    try {
      const completo = await pedirDeudas(pestana, dias, buscarAplicado, ciclo, { tipo, todo: 1, ordenarPor, direccion });
      await exportarTabla({
        titulo: config.titulo,
        metadatos: [
          nombreCiclo ? `Categoría: ${nombreCiclo}` : "Todas las categorías",
          tipo ? `Tipo: ${TIPOS_VENTA.find((t) => t.value === tipo)?.label}` : null,
          buscarAplicado ? `Búsqueda: ${buscarAplicado}` : null,
          pestana === "proximas" ? `Próximos ${dias} días` : null,
          `Total por cobrar: ${dinero(totales.porCobrar)}`,
        ].filter(Boolean),
        columnas: config.columnas,
        filas: completo.filas || [],
        totales: completo.totales || {},
        archivo: `Deudas-${pestana}`,
        formato,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="mantenedor-page">
      {error && <p className="field-error">{error}</p>}

      <section className="mantenedor-card">
        <div className="gestion-tabs">
          {Object.entries(PESTANAS).map(([clave, p]) => (
            <button key={clave} type="button" className={`gestion-tab ${pestana === clave ? "is-activo" : ""}`} onClick={() => cambiarPestana(clave)}>
              {p.etiqueta}<span>{totales[TOTAL_PESTANA[clave]] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="gestion-barra">
          <div className="gestion-filtros">
            <input type="search" placeholder="Buscar alumna o recibo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            <select value={ciclo} onChange={(e) => cambiarFiltro(setCiclo)(e.target.value)} aria-label="Categoría">
              <option value="">TODAS LAS CATEGORÍAS</option>
              {ciclos.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {pestana === "ventas" && (
              <select value={tipoVenta} onChange={(e) => cambiarFiltro(setTipoVenta)(e.target.value)} aria-label="Tipo">
                <option value="">PRODUCTOS Y SERVICIOS</option>
                {TIPOS_VENTA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            )}
            {pestana === "proximas" && (
              <select value={dias} onChange={(e) => cambiarFiltro(setDias)(Number(e.target.value))} aria-label="Días">
                {[3, 7, 15, 30].map((d) => <option key={d} value={d}>Próximos {d} días</option>)}
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
        {pestana === "mensualidades" && (
          <p className="gestion-nota">
            Solo se cuentan periodos activos con saldo. Los periodos marcados como inactivos (la alumna no asistió) no generan deuda.
          </p>
        )}
        <TablaGestion
          paginada
          orden={orden}
          onOrdenar={ordenar}
          columnas={columnasTabla}
          filas={filas}
          totales={datos.totales}
          cargando={cargando}
          vacio="No hay saldos pendientes con estos filtros."
          claveFila={(f, i) => `${f.IDMENSUALIDAD || f.IDVENTA || f.IDALUMNA || f.ALUMNA}-${i}`}
          onFila={(f) => f.IDALUMNA && abrirEstadoCuenta(f.IDALUMNA)}
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
      </section>
    </div>
  );
}
