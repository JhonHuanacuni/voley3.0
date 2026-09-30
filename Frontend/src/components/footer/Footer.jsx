const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <span>VITA VOLEY © {currentYear} — Todos los derechos reservados.</span>
    </footer>
  );
};

export default Footer;
