import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots, faDownload } from "@fortawesome/free-solid-svg-icons";
import { descargarRecibo, enlaceWhatsappRecibo, pdfRecibo } from "../../utils/recibo";

async function dibujarVistaPrevia(bytes, canvas) {
  const [pdfjs, { default: worker }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const documento = await pdfjs.getDocument({ data: bytes }).promise;
  try {
    const pagina = await documento.getPage(1);
    const anchoBase = pagina.getViewport({ scale: 1 }).width;
    const escala = ((canvas.parentElement?.clientWidth || 520) / anchoBase) * (window.devicePixelRatio || 1);
    const viewport = pagina.getViewport({ scale: escala });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await pagina.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  } finally {
    documento.destroy();
  }
}

export default function ReciboModal({ recibo, onClose }) {
  const canvasRef = useRef(null);
  const [telefono, setTelefono] = useState(recibo.telefono || "");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const enlace = enlaceWhatsappRecibo(recibo, telefono);
  const estado = String(recibo.registro.ESTADO_RECIBO || "").toLowerCase();
  const sinValidez = estado === "anulado" || estado === "eliminado";

  useEffect(() => {
    let vigente = true;
    pdfRecibo(recibo)
      .then((bytes) => (vigente ? dibujarVistaPrevia(bytes, canvasRef.current) : null))
      .catch((err) => vigente && setError(err.message || "No se pudo generar el recibo"))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [recibo]);

  const descargar = () => descargarRecibo(recibo).catch((err) => setError(err.message || "No se pudo descargar"));

  const enviar = () => {
    if (!enlace) return;
    window.open(enlace, "_blank", "noopener,noreferrer");
    descargar();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel recibo-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Recibo {recibo.numero}</h2>
        </div>
        <div className="modal-body">
          <div className="recibo-vista">
            {cargando && <p className="recibo-cargando">Generando recibo...</p>}
            <canvas ref={canvasRef} aria-label={`Recibo ${recibo.numero}`} />
          </div>
          {error && <p className="field-error">{error}</p>}
          {!sinValidez && (
            <div className="form-field recibo-telefono">
              <label htmlFor="recibo-telefono">Celular para WhatsApp</label>
              <input
                id="recibo-telefono"
                type="tel"
                inputMode="tel"
                value={telefono}
                placeholder="999 999 999"
                onChange={(event) => setTelefono(event.target.value)}
              />
              <span className={telefono && !enlace ? "field-error" : "field-hint"}>
                {!telefono
                  ? "No tiene celular registrado. Escríbelo para enviar el recibo."
                  : !enlace
                    ? "El número no es válido."
                    : "Al enviar se abre el chat de WhatsApp y se descarga el recibo para adjuntarlo."}
              </span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn-secondary" onClick={descargar} disabled={cargando}>
            <FontAwesomeIcon icon={faDownload} /> Descargar
          </button>
          {!sinValidez && (
            <button type="button" className="btn-primary btn-whatsapp" onClick={enviar} disabled={!enlace || cargando}>
              <FontAwesomeIcon icon={faCommentDots} /> Enviar por WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
