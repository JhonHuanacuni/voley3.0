import { useCallback, useEffect, useState } from "react";
import { parseJsonResponse } from "../utils/api";

/** GET de `url` (sin url no consulta). Mientras recarga conserva los datos anteriores. */
export default function useConsulta(url) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ clave: "", data: null, error: "" });
  const clave = url ? `${url}#${version}` : "";

  useEffect(() => {
    if (!url) return undefined;
    let vigente = true;
    (async () => {
      try {
        const res = await fetch(url);
        const body = await parseJsonResponse(res);
        if (!res.ok) throw new Error(body.error || body.mensaje || "No se pudo cargar la información");
        if (vigente) setResultado({ clave, data: body.data, error: "" });
      } catch (err) {
        if (vigente) setResultado({ clave, data: null, error: err.message });
      }
    })();
    return () => {
      vigente = false;
    };
  }, [url, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { data: resultado.data, error: resultado.error, cargando: Boolean(url) && resultado.clave !== clave, recargar };
}
