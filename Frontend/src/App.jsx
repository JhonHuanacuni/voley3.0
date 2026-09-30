import { useCallback, useEffect, useState } from "react";
import Layout from "./components/layout/Layout";
import LoginPage from "./components/LoginPage";
import "./components/LoginPage.css";
import "./App.css";
import CrudPage from "./modules/crud/CrudPage";
import {
  alumnaConfig,
  auditoriaConfig,
  cicloConfig,
  egresoConfig,
  mensualidadConfig,
  pagoConfig,
  retiradasConfig,
  turnoConfig,
  usuarioConfig,
  ventaConfig,
} from "./modules/crud/configs";
import AsistenciaPage from "./modules/asistencia/AsistenciaPage";
import DashboardPage from "./modules/dashboard/DashboardPage";

const pageContent = {
  dashboard: { title: "Dashboard", component: DashboardPage },
  alumnas: { title: "Alumnas", config: alumnaConfig },
  retiradas: { title: "Retiradas", config: retiradasConfig },
  asistencia: { title: "Asistencia", component: AsistenciaPage },
  mensualidades: { title: "Mensualidades", config: mensualidadConfig },
  pagos: { title: "Pagos", config: pagoConfig },
  ciclos: { title: "Ciclos", config: cicloConfig },
  turnos: { title: "Turnos", config: turnoConfig },
  ventas: { title: "Ventas", config: ventaConfig },
  egresos: { title: "Egresos", config: egresoConfig },
  usuarios: { title: "Usuarios", config: usuarioConfig },
  auditoria: { title: "Auditoría", config: auditoriaConfig },
};

export default function App() {
  const [role, setRole] = useState(() => localStorage.getItem("role") || "");
  const [idusuario, setIdusuario] = useState(() => localStorage.getItem("idusuario") || "");
  const [activePage, setActivePage] = useState(() => localStorage.getItem("activePage") || "dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem("isAuthenticated") === "true");
  const [loginError, setLoginError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const page = pageContent[activePage] || pageContent.dashboard;

  const handleMenuLoaded = useCallback((allowedPages) => {
    setActivePage((current) => {
      if (!allowedPages.length) return "dashboard";
      if (allowedPages.includes(current)) return current;
      return allowedPages.includes("dashboard") ? "dashboard" : allowedPages[0];
    });
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError("");
    try {
      const response = await fetch("/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLoginError(data.error || "Error al iniciar sesión");
        return;
      }
      if (!data.valid) {
        setLoginError("Usuario o contraseña incorrectos");
        return;
      }
      setIsAuthenticated(true);
      setRole(data.role || "secretaria");
      setIdusuario(data.idusuario || username);
      setActivePage("dashboard");
      setPassword("");
      setUsername("");
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("role", data.role || "secretaria");
      localStorage.setItem("idusuario", data.idusuario || username);
      localStorage.setItem("idtipousuario", String(data.idtipousuario || ""));
      localStorage.setItem("activePage", "dashboard");
    } catch {
      setLoginError("No se pudo conectar con el backend");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActivePage("dashboard");
    setRole("");
    setIdusuario("");
    setIsSidebarOpen(false);
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("role");
    localStorage.removeItem("idusuario");
    localStorage.removeItem("idtipousuario");
    localStorage.removeItem("activePage");
  };

  useEffect(() => {
    if (isAuthenticated) localStorage.setItem("activePage", activePage);
  }, [isAuthenticated, activePage]);

  if (!isAuthenticated) {
    return (
      <LoginPage
        username={username}
        password={password}
        loginError={loginError}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
    );
  }

  const Vista = page.component;

  return (
    <Layout
      role={role}
      idusuario={idusuario}
      activePage={activePage}
      onChangePage={setActivePage}
      onMenuLoaded={handleMenuLoaded}
      isSidebarOpen={isSidebarOpen}
      onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      onCloseSidebar={() => setIsSidebarOpen(false)}
      onLogout={handleLogout}
    >
      {Vista ? <Vista role={role} idusuario={idusuario} /> : <CrudPage key={activePage} config={page.config} />}
    </Layout>
  );
}
