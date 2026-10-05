export default function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  onCancel,
  onConfirm,
  confirmando,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  variante = "danger",
}) {
  if (!abierto) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width: "min(420px, 100%)" }}>
        <div className="modal-header">
          <h2>{titulo}</h2>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0 }}>{mensaje}</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={confirmando}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn-${variante}`} onClick={onConfirm} disabled={confirmando}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
