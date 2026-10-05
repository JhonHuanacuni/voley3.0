import { useState } from "react";
import "./graficos.css";

function escala(maximo, enteros) {
  if (maximo <= 0) return { tope: 4, paso: 1 };
  const bruto = maximo / 4;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const multiplos = enteros && magnitud < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  const paso = Math.max(enteros ? 1 : 0, multiplos.map((m) => m * magnitud).find((p) => p >= bruto));
  return { tope: Math.ceil(maximo / paso) * paso, paso };
}

export default function GraficoBarras({
  categorias,
  series,
  filas,
  formato = (valor) => String(valor),
  mostrarValores = false,
  enteros = false,
  alto = 240,
  vacio = "Sin datos para mostrar.",
  detalle,
}) {
  const [activo, setActivo] = useState(null);
  const valor = (fila, serie) => Number(fila?.[serie.clave]) || 0;
  const maximo = Math.max(0, ...filas.flatMap((fila) => series.map((serie) => valor(fila, serie))));
  const { tope, paso } = escala(maximo, enteros);
  const marcas = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);
  const pct = (n) => `${(n / tope) * 100}%`;

  return (
    <div className="grafico">
      <div className="grafico-leyenda">
        {series.map((serie) => (
          <span key={serie.clave}>
            <i style={{ background: serie.color }} />
            {serie.nombre}
          </span>
        ))}
      </div>
      {filas.length ? (
        <>
          <div className="grafico-cuerpo" style={{ height: alto }}>
            <div className="grafico-eje">
              {marcas.map((marca) => (
                <span key={marca} style={{ bottom: pct(marca) }}>{formato(marca)}</span>
              ))}
            </div>
            <div className="grafico-area">
              {marcas.map((marca) => <span key={marca} className="grafico-linea" style={{ bottom: pct(marca) }} />)}
              {filas.map((fila, i) => {
                const serieActiva = activo?.fila === i ? series.find((s) => s.clave === activo.clave) : null;
                const lado = i === 0 ? "inicio" : i === filas.length - 1 ? "fin" : "centro";
                return (
                  <div key={categorias[i]} className="grafico-grupo" onMouseLeave={() => setActivo(null)}>
                    {series.map((serie) => {
                      const n = valor(fila, serie);
                      return (
                        <div
                          key={serie.clave}
                          className={`grafico-barra${serieActiva === serie ? " is-activa" : ""}`}
                          style={{ height: pct(n), background: serie.color }}
                          onMouseEnter={() => setActivo({ fila: i, clave: serie.clave })}
                        >
                          {mostrarValores && n > 0 && <small>{formato(n)}</small>}
                        </div>
                      );
                    })}
                    {serieActiva && (
                      <div
                        className={`grafico-tooltip is-${lado}`}
                        style={{ bottom: `min(calc(${pct(valor(fila, serieActiva))} + 22px), 50%)` }}
                      >
                        <strong>{categorias[i]}</strong>
                        <span>
                          <i style={{ background: serieActiva.color }} />
                          {serieActiva.nombre}: {formato(valor(fila, serieActiva))}
                        </span>
                        {detalle?.(fila)?.map((linea) => <em key={linea}>{linea}</em>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grafico-categorias">
            {categorias.map((categoria) => <span key={categoria}>{categoria}</span>)}
          </div>
        </>
      ) : (
        <p className="grafico-vacio">{vacio}</p>
      )}
    </div>
  );
}
