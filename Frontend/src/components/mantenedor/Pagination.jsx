export default function Pagination({ pagina, tamanio, total, onChange, tamanios, onTamanioChange }) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanio));
  const desde = total === 0 ? 0 : (pagina - 1) * tamanio + 1;
  const hasta = Math.min(pagina * tamanio, total);

  const pages = [];
  for (let i = 1; i <= totalPaginas; i += 1) {
    if (i === 1 || i === totalPaginas || Math.abs(i - pagina) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="mantenedor-pagination">
      <span className="mantenedor-pagination-meta">
        Mostrando {desde}–{hasta} de {total}
        {tamanios?.length ? (
          <label>
            Mostrar
            <select
              value={tamanio}
              onChange={(event) => onTamanioChange?.(Number(event.target.value))}
              aria-label="Registros por página"
            >
              {tamanios.map((opcion) => (
                <option key={opcion} value={opcion}>{opcion}</option>
              ))}
            </select>
          </label>
        ) : null}
      </span>
      <div className="mantenedor-pagination-controls">
        <button type="button" disabled={pagina <= 1} onClick={() => onChange(pagina - 1)}>
          ◂
        </button>
        {pages.map((p, idx) =>
          p === "…" ? (
            <span key={`e-${idx}`}>…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={p === pagina ? "active" : ""}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={pagina >= totalPaginas}
          onClick={() => onChange(pagina + 1)}
        >
          ▸
        </button>
      </div>
    </div>
  );
}
