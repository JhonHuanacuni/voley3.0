import { useRef, useLayoutEffect, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const SidebarSection = ({
  icon,
  label,
  children,
  isOpen,
  onToggle,
  collapsed,
  labelFontSizeCollapsed = 10,
  labelFontSizeExpanded = 16,
  contentTransition = "all 0.25s ease",
  textTransition = "all 0.2s ease",
  activePage,
}) => {
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!collapsed || !isOpen) return;

    const updatePopoverPosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPopoverPos({
          top: rect.top,
          left: rect.right + 8,
        });
      }
    };

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    return () => window.removeEventListener("resize", updatePopoverPosition);
  }, [collapsed, isOpen]);

  useEffect(() => {
    if (!isOpen && popoverRef.current) {
      popoverRef.current.blur?.();
    }
  }, [isOpen]);

  return (
    <div className="sidebar-section" style={{ position: "relative" }}>
      <button
        type="button"
        ref={buttonRef}
        className={`sidebar-section-toggle ${isOpen ? "open" : ""}`}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="sidebar-section-icon">
          <FontAwesomeIcon icon={icon} />
        </span>
        <span className={`sidebar-section-label ${collapsed ? "collapsed" : ""}`}>
          {label}
        </span>
        <span className="sidebar-section-arrow">›</span>
      </button>

      {collapsed && isOpen && (
        <div
          ref={popoverRef}
          className="sidebar-popover"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <div className="sidebar-popover-inner">{children}</div>
        </div>
      )}

      {!collapsed && (
        <div className={`sidebar-section-body ${isOpen ? "open" : "closed"}`}>{children}</div>
      )}
    </div>
  );
};

export default SidebarSection;
