import { useEffect, useState } from "react";
import { mensualidadesDeAlumna } from "../../../utils/combos";

export default function MensualidadAlumnaSelect({ idalumna, value, disabled, onChange }) {
  const [cargadas, setCargadas] = useState({ idalumna: null, lista: [] });

  useEffect(() => {
    if (!idalumna) return undefined;
    let vigente = true;
    mensualidadesDeAlumna(idalumna)
      .then((lista) => vigente && setCargadas({ idalumna, lista }))
      .catch(() => vigente && setCargadas({ idalumna, lista: [] }));
    return () => {
      vigente = false;
    };
  }, [idalumna]);

  const listo = Boolean(idalumna) && cargadas.idalumna === idalumna;
  const opciones = listo ? cargadas.lista : [];
  const placeholder = !idalumna
    ? "SELECCIONA UNA ALUMNA"
    : !listo
      ? "CARGANDO PERIODOS..."
      : opciones.length ? "SELECCIONAR PERIODO" : "LA ALUMNA NO TIENE PERIODOS";

  return (
    <select value={value} disabled={disabled || !idalumna} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {opciones.map((op) => (
        <option key={op.value} value={op.value}>
          {op.label}
        </option>
      ))}
    </select>
  );
}
