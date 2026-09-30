import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faPlus } from "@fortawesome/free-solid-svg-icons";

function BreadcrumbSeg({ children, onClick, className }) {
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <span className={className}>{children}</span>;
}

export default function PageHeader({
  modulo,
  listado,
  vista,
  titulo,
  onNuevo,
  onModuloClick,
  onListadoClick,
  mostrarNuevo = true,
  nuevoEtiqueta = "Nuevo",
  nuevoClase = "btn-primary",
}) {
  const tieneBreadcrumb = Boolean(modulo && vista);

  return (
    <div className={`mantenedor-page-header ${tieneBreadcrumb ? "mantenedor-page-header--breadcrumb" : ""}`}>
      <div className="mantenedor-page-header-main">
        {tieneBreadcrumb ? (
          <nav className="page-breadcrumb" aria-label="Ruta de navegación">
            <BreadcrumbSeg
              className="page-breadcrumb-link"
              onClick={onModuloClick}
            >
              {modulo}
            </BreadcrumbSeg>

            <FontAwesomeIcon icon={faChevronRight} className="page-breadcrumb-sep" aria-hidden="true" />

            {listado ? (
              <>
                <BreadcrumbSeg
                  className="page-breadcrumb-link"
                  onClick={onListadoClick}
                >
                  {listado}
                </BreadcrumbSeg>
                <FontAwesomeIcon icon={faChevronRight} className="page-breadcrumb-sep" aria-hidden="true" />
                <h1 className="page-breadcrumb-vista">{vista}</h1>
              </>
            ) : (
              <h1 className="page-breadcrumb-vista">{vista}</h1>
            )}
          </nav>
        ) : (
          <h1>{titulo}</h1>
        )}
      </div>

      {mostrarNuevo && (
        <button type="button" className={nuevoClase} onClick={onNuevo}>
          <FontAwesomeIcon icon={faPlus} />
          {nuevoEtiqueta}
        </button>
      )}
    </div>
  );
}
