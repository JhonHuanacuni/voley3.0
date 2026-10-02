import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentDots, faFileExcel, faFilePdf } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { abrirEstadoCuenta } from "../../utils/estadoCuenta";
import { exportarTabla } from "../../utils/reporteTabla";
import "../../styles/mantenedor.css";
import "./gestion.css";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function semanaActual(hoy) {
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return { dia: d.getDate(), mes: d.getMonth() + 1 };
  });
}

function whatsapp(numero) {
  const digitos = String(numero || "").replace(/\D/g, "");
  if (digitos.length < 9) return null;
  return `https://wa.me/${digitos.length === 9 ? `51${digitos}` : digitos}`;
}

function textoCumple(persona, hoy) {
  if (persona.FALTAN === 0) return `Cumple ${persona.CUMPLE} años hoy`;
  const mesHoy = hoy.getMonth() + 1;
  const yaPaso = persona.MES < mesHoy || (persona.MES === mesHoy && persona.DIA < hoy.getDate());
  if (yaPaso) return `Cumplió ${persona.CUMPLE - 1} años`;
  return `Cumplirá ${persona.CUMPLE} años · en ${persona.FALTAN} día${persona.FALTAN === 1 ? "" : "s"}`;
}

export default function CumpleanosPage() {
  const hoy = useMemo(() => new Date(), []);
  const [datos, setDatos] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [idCiclo, setIdCiclo] = useState("");
  const [pestana, setPestana] = useState("mes");
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [vista, setVista] = useState("lista");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/catalogos/");
        const data = await parseJsonResponse(res);
        if (res.ok) setCiclos(data.data?.ciclos || []);
      } catch {
        /* el filtro queda sin categorías */
      }
    })();
  }, []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    (async () => {
      try {
        const res = await fetch(`/api/cumpleanos/?idciclo=${encodeURIComponent(idCiclo)}`);
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(data.error || "No se pudieron cargar los cumpleaños");
        if (vigente) setDatos(data.data?.data || []);
      } catch (err) {
        if (vigente) setError(err.message);
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [idCiclo]);

  const semana = useMemo(() => semanaActual(hoy), [hoy]);
  const grupos = useMemo(() => {
    const enSemana = (p) => semana.some((d) => d.dia === p.DIA && d.mes === p.MES);
    const ordenSemana = (p) => semana.findIndex((d) => d.dia === p.DIA && d.mes === p.MES);
    return {
      hoy: datos.filter((p) => p.FALTAN === 0),
      semana: datos.filter(enSemana).sort((a, b) => ordenSemana(a) - ordenSemana(b)),
      mes: datos.filter((p) => p.MES === mes).sort((a, b) => a.DIA - b.DIA || a.NOMBRE.localeCompare(b.NOMBRE)),
      mesActual: datos.filter((p) => p.MES === hoy.getMonth() + 1),
    };
  }, [datos, semana, mes, hoy]);

  const lista = grupos[pestana] || [];
  const nombreCiclo = ciclos.find((c) => c.value === idCiclo)?.label;
  const tituloLista = pestana === "hoy"
    ? "Cumpleañeras de hoy"
    : pestana === "semana"
      ? "Cumpleañeras de esta semana"
      : `Cumpleañeras de ${MESES[mes - 1].toLowerCase()}`;

  const exportar = (formato) => exportarTabla({
    titulo: tituloLista,
    metadatos: [nombreCiclo ? `Categoría: ${nombreCiclo}` : "Todas las categorías"],
    columnas: [
      { key: "FECHA", label: "Cumpleaños", formato: "texto" },
      { key: "NOMBRE", label: "Alumna", formato: "texto" },
      { key: "CUMPLE", label: "Cumple", formato: "entero" },
      { key: "CICLO", label: "Categoría", formato: "texto" },
      { key: "TURNO", label: "Turno", formato: "texto" },
      { key: "APODERADO", label: "Apoderado", formato: "texto" },
      { key: "TELAPODERADO", label: "Teléfono", formato: "texto" },
    ],
    filas: lista.map((p) => ({ ...p, FECHA: `${p.DIA} ${MESES_CORTOS[p.MES - 1]}`, TELAPODERADO: p.TELAPODERADO || p.TELEFONO })),
    archivo: `Cumpleanos-${pestana}${pestana === "mes" ? `-${String(mes).padStart(2, "0")}` : ""}`,
    formato,
  });

  const celdasCalendario = useMemo(() => {
    const anio = hoy.getFullYear();
    const primero = new Date(anio, mes - 1, 1);
    const diasMes = new Date(anio, mes, 0).getDate();
    const vacias = (primero.getDay() + 6) % 7;
    const celdas = Array.from({ length: vacias }, (_, i) => ({ clave: `v${i}`, fuera: true }));
    for (let dia = 1; dia <= diasMes; dia += 1) {
      celdas.push({
        clave: `d${dia}`,
        dia,
        hoy: dia === hoy.getDate() && mes === hoy.getMonth() + 1,
        personas: grupos.mes.filter((p) => p.DIA === dia),
      });
    }
    while (celdas.length % 7) celdas.push({ clave: `f${celdas.length}`, fuera: true });
    return celdas;
  }, [grupos.mes, mes, hoy]);

  return (
    <div className="mantenedor-page">
      <div className="page-header gestion-head">
        <h1>Cumpleaños</h1>
        <div className="gestion-filtros">
          <label>
            Categoría
            <select value={idCiclo} onChange={(e) => setIdCiclo(e.target.value)}>
              <option value="">Todas las categorías</option>
              {ciclos.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}

      <section className="gestion-kpis">
        <button type="button" className={`gestion-kpi ${pestana === "hoy" ? "is-activo" : ""}`} onClick={() => setPestana("hoy")}>
          <p>Hoy</p>
          <strong>{cargando ? "—" : grupos.hoy.length}</strong>
          <small>{hoy.getDate()} de {MESES[hoy.getMonth()].toLowerCase()}</small>
        </button>
        <button type="button" className={`gestion-kpi gestion-kpi--info ${pestana === "semana" ? "is-activo" : ""}`} onClick={() => setPestana("semana")}>
          <p>Esta semana</p>
          <strong>{cargando ? "—" : grupos.semana.length}</strong>
          <small>Lunes a domingo</small>
        </button>
        <button
          type="button"
          className={`gestion-kpi gestion-kpi--ok ${pestana === "mes" && mes === hoy.getMonth() + 1 ? "is-activo" : ""}`}
          onClick={() => {
            setPestana("mes");
            setMes(hoy.getMonth() + 1);
          }}
        >
          <p>Este mes</p>
          <strong>{cargando ? "—" : grupos.mesActual.length}</strong>
          <small>{MESES[hoy.getMonth()]}</small>
        </button>
      </section>

      <section className="mantenedor-card">
        <div className="gestion-tabs">
          {[
            ["hoy", "Hoy", grupos.hoy.length],
            ["semana", "Semana", grupos.semana.length],
            ["mes", "Mes", grupos.mes.length],
          ].map(([clave, etiqueta, total]) => (
            <button key={clave} type="button" className={`gestion-tab ${pestana === clave ? "is-activo" : ""}`} onClick={() => setPestana(clave)}>
              {etiqueta}<span>{total}</span>
            </button>
          ))}
        </div>
        <div className="gestion-barra">
          <div className="gestion-filtros">
            {pestana === "mes" && (
              <>
                <select value={mes} onChange={(e) => setMes(Number(e.target.value))} aria-label="Mes">
                  {MESES.map((nombre, i) => <option key={nombre} value={i + 1}>{nombre}</option>)}
                </select>
                <div className="cumple-vista" role="group" aria-label="Vista">
                  <button type="button" className={vista === "lista" ? "is-activo" : ""} onClick={() => setVista("lista")}>Listado</button>
                  <button type="button" className={vista === "calendario" ? "is-activo" : ""} onClick={() => setVista("calendario")}>Calendario</button>
                </div>
              </>
            )}
            <p>{tituloLista}{nombreCiclo ? ` · ${nombreCiclo}` : ""}</p>
          </div>
          <div className="toolbar-reporte-grupo">
            <button type="button" className="btn-primary toolbar-reporte" disabled={!lista.length} onClick={() => exportar("excel")}>
              <FontAwesomeIcon icon={faFileExcel} /> Excel
            </button>
            <button type="button" className="btn-secondary toolbar-reporte" disabled={!lista.length} onClick={() => exportar("pdf")}>
              <FontAwesomeIcon icon={faFilePdf} /> PDF
            </button>
          </div>
        </div>

        {pestana === "mes" && vista === "calendario" ? (
          <div className="cumple-calendario">
            {DIAS.map((d) => <div key={d} className="cumple-dia-nombre">{d}</div>)}
            {celdasCalendario.map((celda) => (
              <div
                key={celda.clave}
                className={`cumple-dia ${celda.fuera ? "cumple-dia--fuera" : ""} ${celda.hoy ? "cumple-dia--hoy" : ""}`}
              >
                {!celda.fuera && <span className="cumple-dia-num">{celda.dia}</span>}
                {(celda.personas || []).map((p) => (
                  <button
                    key={p.IDALUMNA}
                    type="button"
                    className="cumple-dia-persona"
                    title={`${p.NOMBRE} · ${p.CICLO || "Sin categoría"}`}
                    onClick={() => abrirEstadoCuenta(p.IDALUMNA)}
                  >
                    {p.NOMBRE}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <ul className="cumple-lista">
            {cargando && <li className="gestion-vacio">Cargando…</li>}
            {!cargando && !lista.length && (
              <li className="gestion-vacio">
                {pestana === "hoy" ? "Hoy no hay cumpleaños." : "No hay cumpleaños en este periodo."}
              </li>
            )}
            {!cargando && lista.map((p) => {
              const enlace = whatsapp(p.TELAPODERADO || p.TELEFONO);
              return (
                <li key={p.IDALUMNA} className={`cumple-item ${p.FALTAN === 0 ? "cumple-item--hoy" : ""}`}>
                  <div className="cumple-fecha">
                    <strong>{p.DIA}</strong>
                    <span>{MESES_CORTOS[p.MES - 1]}</span>
                  </div>
                  <div>
                    <h3>
                      <button type="button" onClick={() => abrirEstadoCuenta(p.IDALUMNA)}>{p.NOMBRE}</button>
                    </h3>
                    <p>
                      {textoCumple(p, hoy)} · {p.CICLO || "Sin categoría"}{p.TURNO ? ` · ${p.TURNO}` : ""}
                    </p>
                  </div>
                  <div>
                    {p.FALTAN === 0 && <span className="gestion-chip gestion-chip--hoy">¡Hoy!</span>}{" "}
                    {enlace && (
                      <a className="btn-icon btn-icon--whatsapp" href={enlace} target="_blank" rel="noopener noreferrer" title="Saludar por WhatsApp">
                        <FontAwesomeIcon icon={faCommentDots} />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
