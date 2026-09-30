import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faLock, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import logoOld from "../images/logo.jpg";

export default function LoginPage({
  username,
  password,
  loginError,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}) {
  return (
    <div className="login-vita">
      <div className="login-vita-bg" aria-hidden="true" />
      <div className="login-vita-content">
        <div className="login-vita-card">
          <div className="login-vita-brand">
            <img src={logoOld} alt="VITA VOLEY" className="login-vita-logo" />
            <h1>¡Bienvenido!</h1>
          </div>

          {loginError ? <div className="login-vita-error">{loginError}</div> : null}

          <form className="login-vita-form" onSubmit={onSubmit}>
            <label className="login-vita-field">
              <span className="login-vita-label">
                <FontAwesomeIcon icon={faUser} />
                Usuario
              </span>
              <input
                type="text"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                placeholder="Ingresa tu usuario"
                required
                autoComplete="username"
              />
            </label>

            <label className="login-vita-field">
              <span className="login-vita-label">
                <FontAwesomeIcon icon={faLock} />
                Contraseña
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Ingresa tu contraseña"
                required
                autoComplete="current-password"
              />
            </label>

            <button type="submit" className="login-vita-button">
              <span>Ingresar</span>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
