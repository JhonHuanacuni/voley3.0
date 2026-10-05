const DIAS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];

const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const CLAVES = DIAS.map(normalizar);

function leerDias(value) {
  const partes = String(value || "").split(/[,;/]+/).map(normalizar).filter(Boolean);
  return DIAS.filter((_, i) => partes.includes(CLAVES[i]));
}

export default function DiasSemana({ value, disabled, permitidos, onChange }) {
  const limite = leerDias(permitidos);
  const propios = leerDias(value);
  const marcados = propios.length ? propios : limite;
  const opciones = limite.length ? DIAS.filter((d) => limite.includes(d) || marcados.includes(d)) : DIAS;
  const emitir = (dias) => {
    const elegidos = DIAS.filter((d) => dias.includes(d));
    const igualAlLimite = limite.length && elegidos.length === limite.length && elegidos.every((d) => limite.includes(d));
    onChange(igualAlLimite ? "" : elegidos.join(", "));
  };
  const alternar = (dia) => emitir(marcados.includes(dia) ? marcados.filter((d) => d !== dia) : [...marcados, dia]);

  return (
    <div className="dias-semana-field">
      <div className="dias-semana-grid" role="group" aria-label="Días de la semana">
        {opciones.map((dia) => {
          const activo = marcados.includes(dia);
          return (
            <label key={dia} className={`dias-semana-chip${activo ? " is-active" : ""}`}>
              <input type="checkbox" checked={activo} disabled={disabled} onChange={() => alternar(dia)} />
              <span>{dia}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
