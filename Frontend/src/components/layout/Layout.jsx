import Navbar from "../navbar/Navbar";
import Sidebar from "../sidebar/Sidebar";
import Footer from "../footer/Footer";

const Layout = ({
  children,
  role,
  idusuario,
  activePage,
  onChangePage,
  onMenuLoaded,
  isSidebarOpen,
  onToggleSidebar,
  onCloseSidebar,
  onLogout,
}) => {
  return (
    <div className="app-shell">
      <Sidebar
        idusuario={idusuario}
        activePage={activePage}
        onChangePage={onChangePage}
        onMenuLoaded={onMenuLoaded}
        isOpen={isSidebarOpen}
        onClose={onCloseSidebar}
      />

      <div className="main-content">
        <Navbar
          role={role}
          idusuario={idusuario}
          onToggleSidebar={onToggleSidebar}
          onLogout={onLogout}
        />
        <main className="content">{children}</main>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
