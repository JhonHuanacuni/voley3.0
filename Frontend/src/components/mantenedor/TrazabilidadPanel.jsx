import { useEffect, useState } from "react";
import { parseJsonResponse } from "../../utils/api";
import { dbToView } from "../../utils/fecha";

const ACCIONES_REGISTRO = ["Registrado", "Matrícula", "Emitido"];

function firma(fila) {
  if (!fila) return null;
  return `${fila.IDUSUARIO || "sin usuario"} – ${dbToView(fila.FECHA)} ${String(fila.HORA || "").slice(0, 5)}`;
}

export default function TrazabilidadPanel({ entidad, id }) {
  const [filas, setFilas] = useState(null);

  useEffect(() => {
    if (!entidad || !id) return undefined;
    let vigente = true;
    (async () => {
      try {
        const res = await fetch(`/api/trazabilidad/${entidad}/${encodeURIComponent(id)}/`);
        const data = await parseJsonResponse(res);
        if (vigente) setFilas(res.ok ? data.data || [] : []);
      } catch {
        if (vigente) setFilas([]);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [entidad, id]);

  if (!filas) return null;

  const registro = filas.find((f) => ACCIONES_REGISTRO.includes(f.ACCION));
  const modificaciones = filas.filter((f) => f.ACCION === "Modificado");
  const ultima = modificaciones[modificaciones.length - 1];
  const anulacion = [...filas].reverse().find((f) => ["Anulado", "Eliminado", "Retirado"].includes(f.ACCION));

  return (
    <section className="form-section form-section--card traza-panel">
      <h3>Trazabilidad</h3>
      <div className="traza-resumen">
        <span>Registrado por: <strong>{firma(registro) || "Sin registro (dato anterior al control)"}</strong></span>
        {ultima && <span>Modificado por: <strong>{firma(ultima)}</strong></span>}
        {anulacion && <span>{anulacion.ACCION} por: <strong>{firma(anulacion)}</strong></span>}
      </div>
      {filas.length > 0 && (
        <ul className="traza-historial">
          {[...filas].reverse().map((fila) => (
            <li key={fila.IDAUDITORIA}>
              <span>{dbToView(fila.FECHA)} {String(fila.HORA || "").slice(0, 5)}</span>
              <strong>{fila.ACCION} · {fila.IDUSUARIO || "—"}</strong>
              <span>{fila.DETALLE}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
