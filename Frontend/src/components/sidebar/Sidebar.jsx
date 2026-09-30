import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faSpinner } from "@fortawesome/free-solid-svg-icons";
import SidebarSection from "./SidebarSection";
import SidebarSubLink from "./SidebarSubLink";
import { resolveSidebarIcon } from "./sidebarIcons";
import { etiquetaMenu } from "../../utils/etiquetasVista";
import logoImg from "../../images/logo.jpg";

const MENU_REFRESH_EVENT = "academia:menu-refresh";

export function notifyMenuRefresh() {
  window.dispatchEvent(new CustomEvent(MENU_REFRESH_EVENT));
}

function collectMenuPages(items) {
  const pages = [];
  for (const item of items) {
    if (item.type === "link" && item.page) {
      pages.push(item.page);
    } else if (item.submodulos) {
      for (const child of item.submodulos) {
        if (child.page) pages.push(child.page);
      }
    }
  }
  return pages;
}

const Sidebar = ({ idusuario, activePage, onChangePage, onMenuLoaded, isOpen, onClose }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarMenu = useCallback(async () => {
    if (!idusuario) {
      setMenuItems([]);
      onMenuLoaded?.([]);
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");
      const response = await fetch(
        `/api/menu-usuario/?idusuario=${encodeURIComponent(idusuario)}`
      );
      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Respuesta inválida del menú");
        }
      }
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error al cargar menú (${response.status})`);
      }
      setMenuItems(data.menu || []);
      onMenuLoaded?.(collectMenuPages(data.menu || []));
    } catch (err) {
      console.error("Error cargando menú:", err);
      setError(err.message || "No se pudo cargar el menú");
      setMenuItems([]);
      onMenuLoaded?.([]);
    } finally {
      setCargando(false);
    }
  }, [idusuario, onMenuLoaded]);

  useEffect(() => {
    cargarMenu();
  }, [cargarMenu]);

  useEffect(() => {
    const onRefresh = () => cargarMenu();
    window.addEventListener(MENU_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(MENU_REFRESH_EVENT, onRefresh);
  }, [cargarMenu]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const mobile = width < 900;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(false);
      } else if (width < 1100) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sidebarClasses = ["sidebar"];
  if (collapsed) sidebarClasses.push("sidebar-collapsed");
  if (isMobile) {
    sidebarClasses.push("sidebar-mobile");
    if (isOpen) sidebarClasses.push("sidebar-mobile-open");
  }

  const handleLink = (page) => {
    onChangePage(page);
    if (isMobile) onClose();
  };

  const toggleSection = (sectionKey) => {
    setActiveSection((current) => (current === sectionKey ? null : sectionKey));
  };

  return (
    <aside className={sidebarClasses.join(" ")}>
      <div className="sidebar-brand">
        <img
          src={logoImg}
          alt="Academia Vita"
          className="sidebar-logo"
          title="Academia Vita — ¡Tu límite es el cosmos!"
        />
      </div>

      <nav className="sidebar-nav">
        {cargando ? (
          <div className="sidebar-loading">
            <FontAwesomeIcon icon={faSpinner} spin />
            {!collapsed && <span>Cargando menú...</span>}
          </div>
        ) : error ? (
          <div className="sidebar-error">{!collapsed && <span>{error}</span>}</div>
        ) : menuItems.length === 0 ? (
          <div className="sidebar-empty">
            {!collapsed && <span>Sin módulos asignados</span>}
          </div>
        ) : (
          menuItems.map((item) => {
            if (item.type === "link") {
              return (
                <button
                  key={item.idmodulo}
                  type="button"
                  className={"sidebar-link " + (activePage === item.page ? "active" : "")}
                  onClick={() => handleLink(item.page)}
                >
                  <span className="sidebar-icon">
                    <FontAwesomeIcon icon={resolveSidebarIcon(item.icono)} />
                  </span>
                  {!collapsed && <span className="sidebar-label">{etiquetaMenu(item.nombre, item.page)}</span>}
                </button>
              );
            }

            return (
              <SidebarSection
                key={item.idmodulo}
                icon={resolveSidebarIcon(item.icono)}
                label={etiquetaMenu(item.nombre, item.page)}
                isOpen={activeSection === item.section}
                onToggle={() => toggleSection(item.section)}
                collapsed={collapsed && !isMobile}
                activePage={activePage}
              >
                {(item.submodulos || []).map((child) => (
                  <SidebarSubLink
                    key={child.idsubmodulo}
                    icon={resolveSidebarIcon(child.icono)}
                    label={etiquetaMenu(child.nombre, child.page)}
                    collapsed={collapsed && !isMobile}
                    onClick={() => handleLink(child.page)}
                    active={activePage === child.page}
                  />
                ))}
              </SidebarSection>
            );
          })
        )}
      </nav>

      <div className="sidebar-footer">
        {!isMobile && (
          <button
            type="button"
            className="collapse-toggle sidebar-footer-toggle"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />
          </button>
        )}
      </div>

      {isMobile && isOpen && (
        <button className="sidebar-close" onClick={onClose} aria-label="Cerrar menú">
          ✕
        </button>
      )}
    </aside>
  );
};

export default Sidebar;
