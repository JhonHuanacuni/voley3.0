import { DEFAULT_DIAS_ASISTENCIA, DIAS_SEMANA_PLAN, parseDiasAsistencia, toggleDiaAsistencia } from "../../../utils/diasPlan";

export default function DiasSemanaField({ value, disabled, error, onChange }) {
  const mask = parseDiasAsistencia(value ?? DEFAULT_DIAS_ASISTENCIA);

  return (
    <div className={`dias-semana-field${error ? " has-error" : ""}`}>
      <div className="dias-semana-grid" role="group" aria-label="Días de asistencia del plan">
        {DIAS_SEMANA_PLAN.map((dia) => {
          const checked = Boolean(mask & dia.bit);
          return (
            <label key={dia.bit} className={`dias-semana-chip${checked ? " is-active" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(toggleDiaAsistencia(mask, dia.bit, e.target.checked))}
              />
              <span>{dia.corto}</span>
            </label>
          );
        })}
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
