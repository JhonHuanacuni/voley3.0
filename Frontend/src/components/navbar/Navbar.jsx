import { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faBell, faUser } from "@fortawesome/free-solid-svg-icons";
import PerfilModal from "../perfil/PerfilModal";
import { parseJsonResponse } from "../../utils/api";
import { dbToView } from "../../utils/fecha";

const ROLE_LABELS = {
  estudiante: "Estudiante",
  docente: "Trabajador",
  trabajador: "Trabajador",
  administrador: "Administrador",
  usuario: "Secretaria",
  secretaria: "Secretaria",
  secretario: "Secretaria",
  admin: "Administrador",
};

const ROLE_TO_TIPO = {
  estudiante: "1",
  usuario: "1",
  docente: "2",
  trabajador: "2",
  secretaria: "1",
  secretario: "1",
  administrador: "3",
  admin: "3",
};

function tipoUsuarioActual(role) {
  const stored = localStorage.getItem("idtipousuario");
  if (stored) return String(stored);
  return ROLE_TO_TIPO[role] || "1";
}

function cargoClase(cargo) {
  const v = String(cargo || "").trim().toLowerCase();
  if (v === "trabajador") return "trabajador";
  if (v === "desarrollador") return "desarrollador";
  if (v === "administrador") return "administrador";
  return "";
}

function recortar(texto, max = 140) {
  const s = String(texto || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max).trim()}…`;
}

const Navbar = ({ role, idusuario, onToggleSidebar, onLogout }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPerfil, setShowPerfil] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const userMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  const userRole = ROLE_LABELS[role] || "Usuario";
  const notificationCount = mensajes.length;

  const cargarMensajes = useCallback(async () => {
    try {
      const tipo = tipoUsuarioActual(role);
      const res = await fetch(`/api/mensajes/vigentes/?idtipousuario=${encodeURIComponent(tipo)}`);
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar los avisos");
      setMensajes(data.data || []);
    } catch {
      setMensajes([]);
    }
  }, [role]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        userMenuRef.current && !userMenuRef.current.contains(event.target) &&
        notificationsRef.current && !notificationsRef.current.contains(event.target)
      ) {
        setShowUserMenu(false);
        setShowNotifications(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    cargarMensajes();
  }, [cargarMensajes]);

  return (
    <>
    <header className="app-navbar">
      <div className="navbar-left">
        <button
          className="navbar-toggle"
          onClick={onToggleSidebar}
          aria-label="Abrir menú"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
        <div className="navbar-brand" onClick={() => window.scrollTo(0, 0)}>
          ACADEMIA VITA
        </div>
      </div>

      <div className="navbar-right">
        <div className="navbar-notify" ref={notificationsRef}>
          <button
            className="navbar-icon-btn"
            type="button"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowUserMenu(false);
              if (!showNotifications) cargarMensajes();
            }}
            aria-label="Avisos"
            aria-expanded={showNotifications}
          >
            <FontAwesomeIcon icon={faBell} />
            {notificationCount > 0 && (
              <span className="navbar-badge">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="navbar-notif-panel" role="dialog" aria-label="Avisos vigentes">
              <div className="navbar-notif-head">Avisos vigentes</div>
              {mensajes.length === 0 ? (
                <p className="navbar-notif-empty">No hay avisos vigentes.</p>
              ) : (
                <ul className="navbar-notif-list">
                  {mensajes.map((m) => (
                    <li key={m.IDMENSAJE} className="navbar-notif-item">
                      <div className="navbar-notif-title">{m.TITULO || "Aviso"}</div>
                      <div className="navbar-notif-author-row">
                        <span className="navbar-notif-author">
                          {(m.AUTOR || "").trim() || "VITA VOLEY"}
                        </span>
                        {m.CARGO && (
                          <span className={`navbar-notif-cargo navbar-notif-cargo--${cargoClase(m.CARGO)}`}>
                            {m.CARGO}
                          </span>
                        )}
                      </div>
                      <p className="navbar-notif-body">{recortar(m.MENSAJE)}</p>
                      {(m.FECHAINICIO || m.FECHAFIN) && (
                        <div className="navbar-notif-dates">
                          {dbToView(m.FECHAINICIO)}
                          {m.FECHAFIN ? ` — ${dbToView(m.FECHAFIN)}` : ""}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <span className="navbar-role">{userRole}</span>

        <div className="navbar-user" ref={userMenuRef}>
          <button
            className="navbar-icon-btn"
            onClick={() => {
              setShowUserMenu((prev) => !prev);
              setShowNotifications(false);
            }}
            aria-label="Abrir menú de usuario"
          >
            <FontAwesomeIcon icon={faUser} />
          </button>
          {showUserMenu && (
            <div className="navbar-dropdown">
              <button
                className="navbar-dropdown-item"
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  setShowPerfil(true);
                }}
              >
                Perfil
              </button>
              <button className="navbar-dropdown-item" type="button" onClick={onLogout}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    <PerfilModal
      abierto={showPerfil}
      idusuario={idusuario}
      role={role}
      onClose={() => setShowPerfil(false)}
    />
    </>
  );
};

export default Navbar;
