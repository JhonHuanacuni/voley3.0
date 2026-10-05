import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight, faLock, faUser, faUsers } from "@fortawesome/free-solid-svg-icons";
import useConsulta from "../../hooks/useConsulta";
import { parseJsonResponse } from "../../utils/api";
import { notifyMenuRefresh } from "../../components/sidebar/Sidebar";
import "../../styles/mantenedor.css";
import "./accesos.css";

const TIPO_ADMIN = "3";

const idDe = (item) => item.IDMODULO || item.IDSUBMODULO;

function ListaDoble({ items, vacios, ocupado, seleccionado, onSeleccionar, onCambiar, detalle }) {
  const [arrastrado, setArrastrado] = useState(null);

  const soltar = (asignar) => (event) => {
    event.preventDefault();
    if (arrastrado && arrastrado.ASIGNADO !== asignar && !(arrastrado.PROTEGIDO && !asignar)) {
      onCambiar(arrastrado, asignar);
    }
    setArrastrado(null);
  };

  const panel = (asignar) => {
    const lista = items.filter((item) => item.ASIGNADO === asignar);
    return (
      <div
        className={`accesos-panel ${asignar ? "is-con" : "is-sin"}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={soltar(asignar)}
      >
        <header>
          <h3>{asignar ? "Con acceso" : "Sin acceso"}</h3>
          <span className="accesos-contador">{lista.length}</span>
        </header>
        <ul>
          {lista.map((item) => {
            const id = idDe(item);
            const seleccionable = asignar && onSeleccionar && item.SUBMODULOS > 0;
            return (
              <li
                key={id}
                className={`accesos-item${seleccionable ? " is-seleccionable" : ""}${seleccionado === id ? " is-seleccionado" : ""}`}
                draggable={!ocupado && !(asignar && item.PROTEGIDO)}
                onDragStart={() => setArrastrado(item)}
                onClick={seleccionable ? () => onSeleccionar(id) : undefined}
                onKeyDown={seleccionable ? (event) => event.key === "Enter" && onSeleccionar(id) : undefined}
                tabIndex={seleccionable ? 0 : undefined}
              >
                <div className="accesos-item-info">
                  <strong>{item.NOMBRE}</strong>
                  {item.DESCRIPCION && <small>{item.DESCRIPCION}</small>}
                  {detalle?.(item, seleccionado === id)}
                </div>
                {asignar && item.PROTEGIDO ? (
                  <span className="accesos-candado" title="El administrador siempre lo tiene">
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`accesos-mover ${asignar ? "is-quitar" : "is-dar"}`}
                    title={asignar ? "Quitar acceso" : "Dar acceso"}
                    disabled={ocupado}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCambiar(item, !asignar);
                    }}
                  >
                    <FontAwesomeIcon icon={asignar ? faArrowLeft : faArrowRight} />
                  </button>
                )}
              </li>
            );
          })}
          {!lista.length && <li className="accesos-vacio">{vacios[asignar ? 1 : 0]}</li>}
        </ul>
      </div>
    );
  };

  return (
    <div className="accesos-listas">
      {panel(false)}
      {panel(true)}
    </div>
  );
}

export default function AccesosPage({ idusuario }) {
  const [modo, setModo] = useState("rol");
  const [rol, setRol] = useState("");
  const [usuario, setUsuario] = useState("");
  const [idModulo, setIdModulo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");

  const roles = useConsulta("/api/accesos/roles/");
  const usuarios = useConsulta("/api/accesos/usuarios/");
  const seleccion = modo === "rol" ? rol : usuario;
  const objetivo = modo === "rol" ? { idtipousuario: seleccion } : { idusuario: seleccion };
  const filtro = seleccion ? new URLSearchParams(objetivo).toString() : "";

  const modulos = useConsulta(filtro ? `/api/accesos/modulos/?${filtro}` : "");
  const listaModulos = filtro ? modulos.data || [] : [];
  const moduloActivo = listaModulos.find((m) => m.IDMODULO === idModulo && m.ASIGNADO && m.SUBMODULOS > 0);
  const submodulos = useConsulta(
    moduloActivo ? `/api/accesos/submodulos/?${filtro}&idmodulo=${encodeURIComponent(moduloActivo.IDMODULO)}` : ""
  );

  const rolInfo = (roles.data || []).find((r) => r.IDTIPOUSUARIO === rol);
  const usuarioInfo = (usuarios.data || []).find((u) => u.IDUSUARIO === usuario);
  const esAdmin = modo === "rol" ? rol === TIPO_ADMIN : usuarioInfo?.IDTIPOUSUARIO === TIPO_ADMIN;
  const error = roles.error || usuarios.error || modulos.error || submodulos.error;

  const cambiarModo = (nuevo) => {
    setModo(nuevo);
    setIdModulo("");
    setAviso("");
  };

  const elegir = (setter) => (event) => {
    setter(event.target.value);
    setIdModulo("");
    setAviso("");
  };

  const cambiar = async (recurso, item, asignar) => {
    setGuardando(true);
    setAviso("");
    try {
      const res = await fetch(`/api/accesos/${recurso}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...objetivo,
          [recurso === "modulos" ? "idmodulo" : "idsubmodulo"]: idDe(item),
          asignar,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data.mensaje || data.error || "No se pudo guardar el acceso.");
      if (recurso === "modulos" && asignar && item.SUBMODULOS > 0) setIdModulo(item.IDMODULO);
      modulos.recargar();
      submodulos.recargar();
      const afectaSesion = modo === "rol" ? rol === localStorage.getItem("idtipousuario") : usuario === idusuario;
      if (afectaSesion) notifyMenuRefresh();
    } catch (err) {
      setAviso(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mantenedor-page accesos">
      <section className="mantenedor-card ui-tabs-panel">
        <div className="ui-tabs" role="tablist" aria-label="Asignar accesos">
          <button
            type="button"
            role="tab"
            aria-selected={modo === "rol"}
            className={`ui-tab${modo === "rol" ? " ui-tab--activa" : ""}`}
            onClick={() => cambiarModo("rol")}
          >
            <FontAwesomeIcon icon={faUsers} /> Por rol
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === "usuario"}
            className={`ui-tab${modo === "usuario" ? " ui-tab--activa" : ""}`}
            onClick={() => cambiarModo("usuario")}
          >
            <FontAwesomeIcon icon={faUser} /> Por usuario
          </button>
        </div>
        <div className="ui-tabs-panel-body accesos-selector">
          {modo === "rol" ? (
            <label>
              Rol
              <select value={rol} onChange={elegir(setRol)}>
                <option value="">-- Selecciona un rol --</option>
                {(roles.data || []).map((r) => (
                  <option key={r.IDTIPOUSUARIO} value={r.IDTIPOUSUARIO}>
                    {r.DESCRIPCION} ({r.USUARIOS} {Number(r.USUARIOS) === 1 ? "usuario" : "usuarios"})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Usuario
              <select value={usuario} onChange={elegir(setUsuario)}>
                <option value="">-- Selecciona un usuario --</option>
                {(usuarios.data || []).map((u) => (
                  <option key={u.IDUSUARIO} value={u.IDUSUARIO}>
                    {u.NOMBRE} · {u.IDUSUARIO} ({u.ROL})
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="accesos-nota">
            {modo === "rol"
              ? rolInfo
                ? `Los cambios se aplican a los ${rolInfo.USUARIOS} usuarios con rol ${rolInfo.DESCRIPCION}. Para una sola persona usa "Por usuario".`
                : "Elige qué módulos y opciones del menú ve cada rol. Los cambios se guardan al instante."
              : usuarioInfo
                ? `Hereda los accesos del rol ${usuarioInfo.ROL}; aquí solo agregas o quitas excepciones para esta persona.`
                : "Excepciones para una persona: quitarle algo que su rol tiene o darle algo que su rol no tiene."}
            {esAdmin && " El administrador siempre conserva Dashboard, Academia, Administración y Accesos por rol."}
          </p>
        </div>
      </section>

      {error && <p className="field-error">{error}</p>}
      {aviso && <p className="field-error">{aviso}</p>}

      {seleccion ? (
        <>
          <section className={`mantenedor-card accesos-bloque${modulos.cargando ? " is-cargando" : ""}`}>
            <div className="accesos-bloque-head">
              <h2>Módulos</h2>
              <p>Arrastra entre los paneles o usa las flechas. Haz clic en un módulo con acceso para elegir sus opciones.</p>
            </div>
            <ListaDoble
              items={listaModulos}
              vacios={["Tiene todos los módulos", "Sin módulos asignados"]}
              ocupado={guardando}
              seleccionado={moduloActivo?.IDMODULO}
              onSeleccionar={setIdModulo}
              onCambiar={(item, asignar) => cambiar("modulos", item, asignar)}
              detalle={(item, activo) => item.ASIGNADO && item.SUBMODULOS > 0 && (
                <em className="accesos-resumen">
                  {item.SUBMODULOS_CON_ACCESO}/{item.SUBMODULOS} opciones con acceso
                  {activo ? " · editando" : " · clic para elegir"}
                </em>
              )}
            />
          </section>

          {moduloActivo && (
            <section className={`mantenedor-card accesos-bloque${submodulos.cargando ? " is-cargando" : ""}`}>
              <div className="accesos-bloque-head">
                <h2>Opciones de {moduloActivo.NOMBRE}</h2>
                <p>
                  {modo === "rol"
                    ? "Lo que este rol ve dentro del módulo en el menú."
                    : "Excepciones de esta persona dentro del módulo."}
                </p>
              </div>
              <ListaDoble
                items={submodulos.data || []}
                vacios={["Tiene todas las opciones", "Sin opciones con acceso"]}
                ocupado={guardando}
                onCambiar={(item, asignar) => cambiar("submodulos", item, asignar)}
              />
            </section>
          )}

          <p className="accesos-ayuda">
            Esto define qué ve cada persona en el menú. Lo que puede hacer dentro (registrar, anular, ver saldos,
            gestionar usuarios…) se marca en Administración › Usuarios › Permisos por función; por ejemplo, Usuarios y
            Accesos por rol solo aparecen a quien tiene "Gestionar usuarios".
          </p>
        </>
      ) : (
        <p className="mantenedor-card accesos-inicio">
          {modo === "rol" ? "Selecciona un rol para ver y asignar sus módulos." : "Selecciona un usuario para ver y asignar sus módulos."}
        </p>
      )}
    </div>
  );
}
