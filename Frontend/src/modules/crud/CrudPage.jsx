import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel, faFileInvoiceDollar, faFilePdf, faHandHoldingDollar, faRotate } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { dbToTexto, primerDiaMesInput, ultimoDiaMesInput } from "../../utils/fecha";
import { descargarReporteVentas } from "../../utils/reporteVentas";
import { alCambiarFunciones, puede } from "../../utils/sesion";
import { abrirEstadoCuenta } from "../../utils/estadoCuenta";
import TrazabilidadPanel from "../../components/mantenedor/TrazabilidadPanel";
import { useCrud } from "../../hooks/useCrud";
import PageHeader from "../../components/mantenedor/PageHeader";
import Toolbar from "../../components/mantenedor/Toolbar";
import DataTable from "../../components/mantenedor/DataTable";
import Pagination from "../../components/mantenedor/Pagination";
import FormPage from "../../components/mantenedor/FormPage";
import FormModal from "../../components/mantenedor/FormModal";
import ConfirmDialog from "../../components/mantenedor/ConfirmDialog";
import BoletaVenta from "../../components/mantenedor/BoletaVenta";
import Toast from "../../components/mantenedor/feedback/Toast";
import AbonosVentaModal from "../gestion/AbonosVentaModal";
import DetalleAuditoriaModal from "../../components/mantenedor/DetalleAuditoriaModal";
import "../../styles/mantenedor.css";

export default function CrudPage({ config }) {
  const cfg = config;
  const crud = useCrud({
    entidad: cfg.entidad,
    pk: cfg.pk,
    ordenInicial: cfg.ordenInicial,
    filtrosIniciales: cfg.filtrosIniciales || {},
  });
  const [vista, setVista] = useState("lista");
  const [modo, setModo] = useState("crear");
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [catalogos, setCatalogos] = useState({});
  const [confirmando, setConfirmando] = useState(false);
  const [boleta, setBoleta] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [abonosVenta, setAbonosVenta] = useState(null);
  const [detalleAuditoria, setDetalleAuditoria] = useState(null);
  const [, setVersionFunciones] = useState(0);

  useEffect(() => alCambiarFunciones(() => setVersionFunciones((v) => v + 1)), []);

  const funcionesCfg = cfg.funciones || {};
  const puedeNuevo = cfg.permitirNuevo !== false && puede(...(funcionesCfg.nuevo || []));
  const puedeEditar = cfg.permitirEditar !== false && puede(...(funcionesCfg.editar || ["MODIFICAR_OPERACIONES"]));
  const puedeEliminar = cfg.permitirEliminar !== false && puede(...(funcionesCfg.eliminar || ["ANULAR_OPERACIONES"]));

  useEffect(() => {
    if (!cfg.usaCatalogos) return;
    (async () => {
      try {
        const res = await fetch("/api/catalogos/");
        const data = await parseJsonResponse(res);
        if (!res.ok) return;
        setCatalogos(data.data || {});
      } catch {
        /* el formulario avisa si falta un catálogo */
      }
    })();
  }, [cfg.usaCatalogos]);

  const volverLista = () => {
    setVista("lista");
    crud.setRegistro(null);
    crud.listar();
  };

  const abrirCrear = () => {
    crud.setRegistro(null);
    setModo("crear");
    setVista("form");
  };

  const abrirVer = async (row) => {
    try {
      const data = await crud.obtener(row[cfg.pk]);
      crud.setRegistro(data);
      setModo("ver");
      setVista("form");
    } catch (err) {
      setToast({ mensaje: err.message, tipo: "error" });
    }
  };

  const abrirDetalleAuditoria = async (row) => {
    try {
      setDetalleAuditoria(await crud.obtener(row[cfg.pk]));
    } catch (err) {
      setToast({ mensaje: err.message, tipo: "error" });
    }
  };

  const abrirEditar = async (row) => {
    try {
      const data = await crud.obtener(row[cfg.pk]);
      crud.setRegistro(data);
      setModo("editar");
      setVista("form");
    } catch (err) {
      setToast({ mensaje: err.message, tipo: "error" });
    }
  };

  const abrirBoleta = async (row) => {
    try {
      const detalle = await crud.obtener(row[cfg.pk]);
      setBoleta({ ...row, ...detalle, TURNO: row.TURNO || detalle.TURNO });
    } catch {
      setBoleta(row);
    }
  };

  const guardar = async (payload) => {
    const mensaje = modo === "crear"
      ? await crud.insertar(payload)
      : await crud.actualizar(crud.registro[cfg.pk], payload);
    setToast({ mensaje, tipo: "success" });
    volverLista();
  };

  const confirmarEliminar = async () => {
    if (!confirm) return;
    setConfirmando(true);
    try {
      const mensaje = confirm.tipo === "anular"
        ? await anularRecibo(confirm.id)
        : confirm.tipo === "renovar"
          ? await renovarPeriodo(confirm.id)
          : await crud.eliminar(confirm.id);
      setToast({ mensaje, tipo: "success" });
      setConfirm(null);
      crud.listar();
    } catch (err) {
      setToast({ mensaje: err.message, tipo: "error" });
    } finally {
      setConfirmando(false);
    }
  };

  const anularRecibo = async (id) => {
    const res = await fetch(`/api/ventas/${encodeURIComponent(id)}/anular/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-IdUsuario": localStorage.getItem("idusuario") || "",
      },
    });
    const data = await parseJsonResponse(res);
    if (!res.ok || !data.ok) throw new Error(data.mensaje || data.error || "No se pudo anular");
    return data.mensaje;
  };

  const renovarPeriodo = async (id) => {
    const res = await fetch(`/api/mensualidades/${encodeURIComponent(id)}/renovar/`, { method: "POST" });
    const data = await parseJsonResponse(res);
    if (!res.ok || !data.ok) throw new Error(data.mensaje || data.error || "No se pudo generar el periodo siguiente");
    return data.mensaje;
  };

  const accionesExtra = (cfg.acciones || [])
    .map((accion) => {
      if (accion === "renovar") {
        if (!puede("REGISTRAR_MENSUALIDADES")) return null;
        return {
          id: "renovar",
          icono: faRotate,
          titulo: "Generar el periodo siguiente",
          visible: (row) => row.ESTADO !== "Inactivo",
          onClick: (row) => setConfirm({
            tipo: "renovar",
            id: row[cfg.pk],
            nombre: `${row.ALUMNA} (${dbToTexto(row.FECHAINICIO)} al ${dbToTexto(row.FECHAFIN)})`,
          }),
        };
      }
      if (accion === "abonos") {
        return {
          id: "abonos",
          icono: faHandHoldingDollar,
          titulo: "Abonos y saldo",
          onClick: (row) => setAbonosVenta(row[cfg.pk]),
        };
      }
      if (accion === "estadoCuenta") {
        return {
          id: "estadoCuenta",
          icono: faFileInvoiceDollar,
          titulo: "Estado de cuenta",
          onClick: (row) => abrirEstadoCuenta(row.IDALUMNA),
        };
      }
      return null;
    })
    .filter(Boolean);

  const textosConfirmacion = () => {
    if (!confirm) return { titulo: "", mensaje: "", boton: "" };
    if (confirm.tipo === "anular") {
      return {
        titulo: "Anular recibo",
        mensaje: `¿Anular el recibo ${confirm.nombre}? El número se conserva y no se vuelve a usar.`,
        boton: "Anular",
      };
    }
    if (confirm.tipo === "renovar") {
      return {
        titulo: "Generar periodo siguiente",
        mensaje: `Se creará el periodo que sigue a ${confirm.nombre}. Si tiene promoción, el monto sale de la promoción.`,
        boton: "Generar",
      };
    }
    return {
      titulo: "Eliminar registro",
      mensaje: cfg.controlRecibos
        ? `¿Eliminar el recibo ${confirm.nombre}? Queda registrado quién lo eliminó y el número no se reutiliza.`
        : `¿Eliminar ${confirm.nombre}?`,
      boton: "Eliminar",
    };
  };

  const tituloForm = modo === "crear"
    ? `${cfg.femenino ? "Nueva" : "Nuevo"} ${cfg.singular || cfg.titulo.toLowerCase()}`
    : modo === "editar"
      ? `Editar ${cfg.singular || cfg.titulo.toLowerCase()}`
      : `Ver ${cfg.singular || cfg.titulo.toLowerCase()}`;

  const periodoReporte = () => {
    const desde = crud.filtros.desde || primerDiaMesInput();
    const hasta = crud.filtros.hasta || ultimoDiaMesInput();
    const vista = (fecha) => {
      const partes = String(fecha || "").split("-");
      return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : "";
    };
    return { desde, hasta, texto: `${vista(desde)} al ${vista(hasta)}` };
  };

  const descargarReporte = async (formato) => {
    const { desde, hasta } = periodoReporte();
    if (!crud.filtros.desde) crud.setFiltro("desde", desde);
    if (!crud.filtros.hasta) crud.setFiltro("hasta", hasta);
    if (desde > hasta) {
      setToast({ mensaje: "La fecha desde tiene que ser anterior o igual a la fecha hasta.", tipo: "error" });
      return;
    }
    setDescargando(true);
    try {
      const cantidad = await descargarReporteVentas({
        desde,
        hasta,
        estado: crud.filtros.estado || "",
        buscar: crud.buscar || "",
        extras: {
          idciclo: crud.filtros.idciclo,
          tipo: crud.filtros.tipo,
          producto: crud.filtros.producto,
          saldo: crud.filtros.saldo,
        },
        formato,
      });
      const archivo = formato === "pdf" ? "PDF" : "Excel";
      setToast({ mensaje: `${archivo} descargado con ${cantidad} ventas del periodo revisado.`, tipo: "success" });
    } catch (err) {
      setToast({ mensaje: err.message, tipo: "error" });
    } finally {
      setDescargando(false);
    }
  };

  const filtros = (cfg.filtros || []).map((filtro) => ({
    key: filtro.key,
    etiqueta: filtro.etiqueta,
    tipo: filtro.tipo,
    value: crud.filtros[filtro.key] || "",
    vacio: filtro.vacio,
    opciones: filtro.catalogo ? (catalogos[filtro.catalogo] || []) : filtro.opciones,
    onChange: (valor) => crud.setFiltro(filtro.key, valor),
  }));

  if (vista === "form" && cfg.formulario !== "modal") {
    return (
      <>
        <FormPage
          modo={modo}
          modulo={cfg.modulo}
          listado={cfg.titulo}
          titulo={tituloForm}
          secciones={cfg.secciones}
          campos={cfg.campos}
          registro={crud.registro}
          catalogos={catalogos}
          onCancel={volverLista}
          onSubmit={guardar}
          onFieldChange={cfg.onFieldChange
            ? (campo, valor, setValues) => cfg.onFieldChange(campo, valor, setValues, catalogos)
            : undefined}
          pie={cfg.traza && modo !== "crear" && crud.registro
            ? <TrazabilidadPanel entidad={cfg.entidad} id={crud.registro[cfg.pk]} />
            : null}
        />
        {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
      </>
    );
  }

  return (
    <div className="mantenedor-page">
      <PageHeader
        modulo={cfg.modulo}
        vista={cfg.titulo}
        onNuevo={puedeNuevo ? abrirCrear : undefined}
        mostrarNuevo={puedeNuevo}
      />
      <div className="mantenedor-card">
        <Toolbar
          buscar={crud.buscar}
          onBuscarChange={crud.onBuscarChange}
          filtros={filtros}
          placeholder={cfg.placeholder || "Buscar..."}
        />
        {cfg.reporteVentas && (
          <div className="vista-previa-reporte">
            <p>
              {crud.loading
                ? "Actualizando la vista previa..."
                : crud.total
                  ? `Vista previa: ${crud.total} ventas del ${periodoReporte().texto}${crud.filtros.estado ? `, estado ${crud.filtros.estado}` : ""}. Revisa la lista y después descarga.`
                  : `Vista previa: no hay ventas del ${periodoReporte().texto}.`}
            </p>
            <div className="toolbar-reporte-grupo">
              <button type="button" className="btn-primary toolbar-reporte" disabled={descargando || crud.loading || crud.total === 0} onClick={() => descargarReporte("excel")}>
                <FontAwesomeIcon icon={faFileExcel} />
                Excel
              </button>
              <button type="button" className="btn-secondary toolbar-reporte" disabled={descargando || crud.loading || crud.total === 0} onClick={() => descargarReporte("pdf")}>
                <FontAwesomeIcon icon={faFilePdf} />
                PDF
              </button>
            </div>
          </div>
        )}
        {crud.error && <p className="field-error">{crud.error}</p>}
        <DataTable
          columnas={cfg.columnas}
          items={crud.items}
          pk={cfg.pk}
          orden={crud.orden}
          loading={crud.loading}
          onOrden={crud.toggleOrden}
          onVer={cfg.detalleAuditoria ? abrirDetalleAuditoria : cfg.permitirVer === false ? undefined : abrirVer}
          onVerBoleta={cfg.boleta ? abrirBoleta : undefined}
          onAnular={cfg.controlRecibos && puede("ANULAR_OPERACIONES") ? ((row) => setConfirm({
            tipo: "anular",
            id: row[cfg.pk],
            nombre: row.NUMERO || row[cfg.pk],
          })) : undefined}
          accionesExtra={accionesExtra}
          onEditar={puedeEditar ? abrirEditar : undefined}
          onEliminar={!puedeEliminar ? undefined : ((row) => setConfirm({
            tipo: "eliminar",
            id: row[cfg.pk],
            nombre: row.NUMERO || row.NOMBRE || row.CONCEPTO || row.ALUMNA || row[cfg.pk],
          }))}
          onWhatsapp={cfg.whatsapp ? (row) => {
            const digits = String(row[cfg.whatsapp] || "").replace(/\D/g, "");
            if (!digits) return;
            const numero = digits.length === 9 ? `51${digits}` : digits;
            window.open(`https://wa.me/${numero}`, "_blank", "noopener,noreferrer");
          } : undefined}
          pagina={crud.pagina}
          tamanio={crud.tamanio}
        />
        <Pagination
          pagina={crud.pagina}
          tamanio={crud.tamanio}
          total={crud.total}
          onChange={crud.setPagina}
          tamanios={cfg.tamanios}
          onTamanioChange={crud.setTamanio}
        />
      </div>
      <ConfirmDialog
        abierto={Boolean(confirm)}
        titulo={textosConfirmacion().titulo}
        mensaje={textosConfirmacion().mensaje}
        confirmLabel={textosConfirmacion().boton}
        confirmando={confirmando}
        onCancel={() => setConfirm(null)}
        onConfirm={confirmarEliminar}
      />
      {vista === "form" && cfg.formulario === "modal" && (
        <FormModal
          abierto
          compacto
          modo={modo}
          titulo={tituloForm}
          campos={cfg.campos}
          registro={crud.registro}
          catalogos={catalogos}
          onClose={volverLista}
          onSubmit={guardar}
        />
      )}
      {abonosVenta && (
        <AbonosVentaModal
          idVenta={abonosVenta}
          onClose={() => setAbonosVenta(null)}
          onCambio={() => crud.listar()}
        />
      )}
      {detalleAuditoria && (
        <DetalleAuditoriaModal registro={detalleAuditoria} onClose={() => setDetalleAuditoria(null)} />
      )}
      {boleta && <BoletaVenta venta={boleta} onClose={() => setBoleta(null)} />}
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}
