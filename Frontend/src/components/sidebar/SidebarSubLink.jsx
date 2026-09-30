import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const SidebarSubLink = ({ icon, label, onClick, collapsed, active }) => {
  return (
    <button
      type="button"
      className={`sidebar-sublink ${collapsed ? "collapsed" : ""} ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="sidebar-sublink-icon">
        <FontAwesomeIcon icon={icon} />
      </span>
      <span className="sidebar-sublink-label">{label}</span>
    </button>
  );
};

export default SidebarSubLink;
