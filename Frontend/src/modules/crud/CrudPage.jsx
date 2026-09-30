import { useEffect, useState } from "react";
import { parseJsonResponse } from "../../utils/api";
import { dbToTexto } from "../../utils/fecha";
import { useCrud } from "../../hooks/useCrud";
import PageHeader from "../../components/mantenedor/PageHeader";
import Toolbar from "../../components/mantenedor/Toolbar";
import DataTable from "../../components/mantenedor/DataTable";
import Pagination from "../../components/mantenedor/Pagination";
import FormPage from "../../components/mantenedor/FormPage";
import FormModal from "../../components/mantenedor/FormModal";
import ConfirmDialog from "../../components/mantenedor/ConfirmDialog";
import Toast from "../../components/mantenedor/feedback/Toast";
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

  useEffect(() => {
    if (!cfg.usaCatalogos) return;
    (async () => {
      try {
        const res = await fetch("/api/catalogos/");
        const data = await parseJsonResponse(res);
        if (!res.ok) return;
        const dataCatalogos = data.data || {};
        if (Array.isArray(dataCatalogos.mensualidades)) {
          dataCatalogos.mensualidades = dataCatalogos.mensualidades.map((item) => ({
            ...item,
            label: `${item.nombre} (${dbToTexto(item.inicio)} - ${dbToTexto(item.fin)})`,
          }));
        }
        setCatalogos(dataCatalogos);
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
      const mensaje = await crud.eliminar(confirm.id);
      setToast({ mensaje, tipo: "success" });
      setConfirm(null);
      crud.listar();
    } catch (err) {
      setToast({ mensaje: err.message, tipo: "error" });
    } finally {
      setConfirmando(false);
    }
  };

  const tituloForm = modo === "crear"
    ? `Nuevo ${cfg.singular || cfg.titulo.toLowerCase()}`
    : modo === "editar"
      ? `Editar ${cfg.singular || cfg.titulo.toLowerCase()}`
      : `Ver ${cfg.singular || cfg.titulo.toLowerCase()}`;

  const filtros = (cfg.filtros || []).map((filtro) => ({
    key: filtro.key,
    etiqueta: filtro.etiqueta,
    value: crud.filtros[filtro.key] || "",
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
        onNuevo={cfg.permitirNuevo === false ? undefined : abrirCrear}
        mostrarNuevo={cfg.permitirNuevo !== false}
      />
      <div className="mantenedor-card">
        <Toolbar
          buscar={crud.buscar}
          onBuscarChange={crud.onBuscarChange}
          filtros={filtros}
          placeholder={cfg.placeholder || "Buscar..."}
        />
        {crud.error && <p className="field-error">{crud.error}</p>}
        <DataTable
          columnas={cfg.columnas}
          items={crud.items}
          pk={cfg.pk}
          orden={crud.orden}
          loading={crud.loading}
          onOrden={crud.toggleOrden}
          onVer={cfg.permitirVer === false ? undefined : abrirVer}
          onEditar={cfg.permitirEditar === false ? undefined : abrirEditar}
          onEliminar={cfg.permitirEliminar === false ? undefined : ((row) => setConfirm({
            id: row[cfg.pk],
            nombre: row.NOMBRE || row.CONCEPTO || row.ALUMNA || row[cfg.pk],
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
        titulo="Eliminar registro"
        mensaje={confirm ? `¿Eliminar ${confirm.nombre}?` : ""}
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
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast(null)} />}
    </div>
  );
}
