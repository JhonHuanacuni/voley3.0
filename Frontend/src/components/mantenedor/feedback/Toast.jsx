import { useEffect } from "react";

export default function Toast({ mensaje, tipo = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="toast-container">
      <div className={`toast ${tipo}`}>{mensaje}</div>
    </div>
  );
}
