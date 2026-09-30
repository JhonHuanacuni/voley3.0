import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faUser,
  faXmark,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { dbToView } from "../../utils/fecha";
import "../../styles/mantenedor.css";
import "./perfil.css";

const ROLE_LABELS = {
  estudiante: "Secretaria",
  docente: "Secretaria",
  trabajador: "Secretaria",
  administrador: "Administrador",
  usuario: "Secretaria",
  secretaria: "Secretaria",
  secretario: "Secretaria",
  admin: "Administrador",
};

function fotoSrc(foto) {
  if (!foto) return null;
  const raw = String(foto).trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

function formatFechaNacimiento(val) {
  if (!val) return "—";
  const s = String(val).trim();
  if (s.length === 8 && /^\d{8}$/.test(s)) return dbToView(s);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function nombreCompleto(u) {
  return [u?.APELLIDO, u?.NOMBRE].filter(Boolean).join(" ").trim() || "—";
}

function rolEtiqueta(usuario, role) {
  return (
    usuario?.TIPOUSUARIO_DESCRIPCION ||
    ROLE_LABELS[role] ||
    "Usuario"
  ).toUpperCase();
}

function CampoInfo({ etiqueta, valor }) {
  return (
    <div className="perfil-campo">
      <span className="perfil-campo-label">{etiqueta}</span>
      <span className="perfil-campo-valor">{valor || "—"}</span>
    </div>
  );
}

export default function PerfilModal({ abierto, idusuario, role, onClose }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto || !idusuario) {
      setUsuario(null);
      setError("");
      return;
    }

    let cancelado = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/usuarios/${encodeURIComponent(idusuario)}/`);
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(data.error || "No se pudo cargar el perfil.");
        if (!cancelado) setUsuario(data.data || null);
      } catch (err) {
        if (!cancelado) setError(err.message || "Error al cargar el perfil.");
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [abierto, idusuario]);

  useEffect(() => {
    if (!abierto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto, onClose]);

  if (!abierto) return null;

  const tituloRol = ROLE_LABELS[role] || "Usuario";
  const avatar = fotoSrc(usuario?.FOTO);
  const dni = usuario?.DNI || idusuario;
  const qrUrl = `/api/usuarios/${encodeURIComponent(idusuario)}/qr/?t=${encodeURIComponent(dni)}`;

  const descargarCarnet = () => {
    window.open(`/api/usuarios/${encodeURIComponent(idusuario)}/carnet/`, "_blank");
  };

  return createPortal(
    <div className="modal-overlay perfil-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-panel modal-panel--wide perfil-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="perfil-modal-title"
      >
        <div className="perfil-modal-header">
          <h2 id="perfil-modal-title">Perfil del {tituloRol}</h2>
          <button type="button" className="perfil-close" onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="perfil-modal-body">
          {loading && (
            <div className="perfil-loading">
              <FontAwesomeIcon icon={faSpinner} spin />
              Cargando perfil…
            </div>
          )}

          {!loading && error && <p className="field-error perfil-error">{error}</p>}

          {!loading && !error && usuario && (
            <>
              <div className="perfil-hero">
                <div className="perfil-avatar-wrap">
                  {avatar ? (
                    <img src={avatar} alt="" className="perfil-avatar" />
                  ) : (
                    <div className="perfil-avatar perfil-avatar--placeholder">
                      <FontAwesomeIcon icon={faUser} />
                    </div>
                  )}
                </div>
                <p className="perfil-nombre-hero">{nombreCompleto(usuario).toUpperCase()}</p>
              </div>

              <div className="perfil-grid">
                <aside className="perfil-carnet-card">
                  <div className="perfil-qr-wrap">
                    <img src={qrUrl} alt={`QR ${dni}`} className="perfil-qr" />
                  </div>
                  <div className="perfil-badge perfil-badge--dni">{dni}</div>
                  <div className="perfil-badge perfil-badge--rol">
                    {rolEtiqueta(usuario, role)}
                  </div>
                </aside>

                <section className="perfil-info-card">
                  <h3 className="perfil-info-title">Información personal</h3>
                  <div className="perfil-info-grid">
                    <CampoInfo etiqueta="Nombre" valor={nombreCompleto(usuario).toUpperCase()} />
                    <CampoInfo etiqueta="DNI" valor={usuario.DNI} />
                    <CampoInfo etiqueta="Email" valor={usuario.EMAIL} />
                    <CampoInfo
                      etiqueta="Fecha de nacimiento"
                      valor={formatFechaNacimiento(usuario.FECHANACIMIENTO)}
                    />
                    <CampoInfo etiqueta="Teléfono" valor={usuario.TELPERSONAL} />
                    <CampoInfo etiqueta="Dirección" valor={usuario.DIRECCION} />
                  </div>
                </section>
              </div>

              <div className="perfil-footer">
                <button type="button" className="btn-perfil-carnet" onClick={descargarCarnet}>
                  <FontAwesomeIcon icon={faDownload} />
                  Descargar carnet
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
