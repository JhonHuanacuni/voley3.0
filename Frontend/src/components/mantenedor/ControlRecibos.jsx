import { useEffect, useState } from "react";
import { parseJsonResponse } from "../../utils/api";
import { dbToView } from "../../utils/fecha";

function momento(fecha, hora, usuario) {
  const dia = dbToView(String(fecha || ""));
  const partes = [dia, hora, usuario].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Sin dato de la operación";
}

export default function ControlRecibos({ version = 0 }) {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await fetch("/api/ventas/control/");
        const data = await parseJsonResponse(res);
        if (activo && res.ok) setDatos(data.data);
      } catch {
        if (activo) setDatos(null);
      }
    })();
    return () => {
      activo = false;
    };
  }, [version]);

  if (!datos) return null;
  const anulados = datos.anulados || [];
  const eliminados = datos.eliminados || [];
  const saltos = datos.saltos || [];

  return (
    <section className="control-recibos">
      <h2>Control de recibos</h2>
      <div className="control-recibos-grid">
        <article>
          <h3>Saltos en la numeración</h3>
          {saltos.length ? (
            <ul>{saltos.map((numero) => <li key={numero}>{numero}</li>)}</ul>
          ) : (
            <p>La numeración no tiene saltos.</p>
          )}
        </article>
        <article>
          <h3>Recibos anulados</h3>
          {anulados.length ? (
            <ul>
              {anulados.map((item) => (
                <li key={item.IDVENTA}>
                  <strong>{item.NUMERO}</strong>
                  <span>{momento(item.FECHA_ANULACION, item.HORA_ANULACION, item.USUARIO_ANULACION)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay recibos anulados.</p>
          )}
        </article>
        <article>
          <h3>Recibos eliminados</h3>
          {eliminados.length ? (
            <ul>
              {eliminados.map((item) => (
                <li key={item.IDVENTA}>
                  <strong>{item.NUMERO}</strong>
                  <span>{momento(item.FECHA_ELIMINACION, item.HORA_ELIMINACION, item.USUARIO_ELIMINACION)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay recibos eliminados.</p>
          )}
        </article>
      </div>
    </section>
  );
}
