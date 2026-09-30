const Header = ({ onToggleSidebar, role, onChangeRole, onLogout }) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <button className="hamburger" onClick={onToggleSidebar} aria-label="Abrir menú">
          ☰
        </button>
        <div>
          <div className="brand-title">ACADEMIA VITA</div>
        </div>
      </div>

      <div className="header-right">
        <label className="role-label" htmlFor="role-select">
          Rol:
          <select
            id="role-select"
            value={role}
            onChange={(event) => onChangeRole(event.target.value)}
          >
            <option value="administrador">Administrador</option>
            <option value="docente">Trabajador</option>
            <option value="estudiante">Estudiante</option>
          </select>
        </label>
        <button className="logout-button" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
};

export default Header;
