import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBan, faXmark } from "@fortawesome/free-solid-svg-icons";
import { parseJsonResponse } from "../../utils/api";
import { dbToView, hoyInput } from "../../utils/fecha";
import { puede } from "../../utils/sesion";
import TablaGestion, { dinero } from "./TablaGestion";
import "../../styles/mantenedor.css";
import "./gestion.css";

const MEDIOS = ["Efectivo", "Transferencia", "Tarjeta", "Yape", "Plin", "Otro"];

const cabeceras = () => ({
  "Content-Type": "application/json",
  "X-IdUsuario": localStorage.getItem("idusuario") || "",
});

export default function AbonosVentaModal({ idVenta, onClose, onCambio }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ FECHA: hoyInput(), MONTO: "", MEDIO: "Efectivo", OBSERVACION: "" });
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/ventas/${encodeURIComponent(idVenta)}/abonos/`);
      const body = await parseJsonResponse(res);
      if (!res.ok) throw new Error(body.error || "No se pudo cargar el historial de abonos");
      setData(body.data);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [idVenta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const alTeclear = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onClose]);

  const venta = data?.venta || {};
  const abonos = data?.abonos || [];
  const saldo = Number(venta.SALDO || 0);
  const emitido = venta.ESTADO_RECIBO === "Emitido";
  const puedeAbonar = emitido && saldo > 0 && puede("REGISTRAR_VENTAS", "EMITIR_RECIBOS");
  const puedeAnular = emitido && puede("ANULAR_OPERACIONES");

  const registrar = async (e) => {
    e.preventDefault();
    const monto = Number(form.MONTO);
    if (!monto || monto <= 0) {
      setAviso({ tipo: "error", texto: "Ingresa un monto mayor a cero." });
      return;
    }
    if (monto > saldo + 0.001) {
      setAviso({ tipo: "error", texto: `El abono no puede superar el saldo de ${dinero(saldo)}.` });
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/ventas/${encodeURIComponent(idVenta)}/abonos/`, {
        method: "POST",
        headers: cabeceras(),
        body: JSON.stringify(form),
      });
      const body = await parseJsonResponse(res);
      if (!res.ok || !body.ok) throw new Error(body.mensaje || body.error || "No se pudo registrar el abono");
      setAviso({ tipo: "ok", texto: body.mensaje });
      setForm((prev) => ({ ...prev, MONTO: "", OBSERVACION: "" }));
      await cargar();
      onCambio?.();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    } finally {
      setGuardando(false);
    }
  };

  const anular = async (abono) => {
    if (!window.confirm(`¿Anular el abono ${abono.IDABONO} de ${dinero(abono.MONTO)}? El monto vuelve al saldo.`)) return;
    try {
      const res = await fetch(`/api/abonos/${encodeURIComponent(abono.IDABONO)}/anular/`, { method: "POST", headers: cabeceras() });
      const body = await parseJsonResponse(res);
      if (!res.ok || !body.ok) throw new Error(body.mensaje || body.error || "No se pudo anular el abono");
      setAviso({ tipo: "ok", texto: body.mensaje });
      await cargar();
      onCambio?.();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message });
    }
  };

  const columnas = [
    { key: "FECHA", label: "Fecha", formato: "fecha" },
    { key: "IDABONO", label: "Código", formato: "texto" },
    { key: "ORIGEN", label: "Tipo", formato: "texto" },
    { key: "MONTO", label: "Monto", formato: "moneda" },
    { key: "MEDIO", label: "Medio", formato: "texto" },
    { key: "OBSERVACION", label: "Observación", formato: "texto" },
    {
      key: "IDUSUARIO",
      label: "Registrado por",
      formato: "texto",
      render: (f) => (f.IDUSUARIO
        ? `${f.IDUSUARIO}${f.FECHAREGISTRO ? ` · ${dbToView(String(f.FECHAREGISTRO))}` : ""}${f.HORAREGISTRO ? ` ${f.HORAREGISTRO}` : ""}`
        : "—"),
    },
    ...(puedeAnular
      ? [{
          key: "ACCION",
          label: "",
          formato: "texto",
          render: (f) => (f.ORIGEN === "Abono" ? (
            <button type="button" className="btn-icon" title="Anular abono" onClick={() => anular(f)}>
              <FontAwesomeIcon icon={faBan} />
            </button>
          ) : null),
        }]
      : []),
  ];

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel estado-cuenta-panel" role="dialog" aria-modal="true" aria-label="Abonos de la venta">
        <div className="estado-cuenta-head">
          <div>
            <h2>Abonos · Recibo {venta.NUMERO || idVenta}</h2>
            {data && <p>{venta.NOMBRE} · {venta.PRODUCTO}</p>}
          </div>
          <button type="button" className="estado-cuenta-cerrar" onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {error && <p className="field-error">{error}</p>}
        {!data && !error && <p className="gestion-vacio">Cargando abonos…</p>}

        {data && (
          <div className="estado-cuenta-cuerpo">
            <section className="gestion-kpis">
              <div className="gestion-kpi gestion-kpi--info">
                <p>Total de la venta</p>
                <strong>{dinero(venta.PRECIO)}</strong>
                <small>{venta.TIPO}</small>
              </div>
              <div className="gestion-kpi gestion-kpi--ok">
                <p>Pagado</p>
                <strong>{dinero(venta.PAGADO)}</strong>
                <small>{abonos.length} pago(s)</small>
              </div>
              <div className={`gestion-kpi ${saldo > 0 ? "gestion-kpi--peligro" : "gestion-kpi--ok"}`}>
                <p>Saldo pendiente</p>
                <strong>{dinero(saldo)}</strong>
                <small>{emitido ? (saldo > 0 ? "Calculado automáticamente" : "Pagado por completo") : `Recibo ${venta.ESTADO_RECIBO}`}</small>
              </div>
            </section>

            {puedeAbonar && (
              <form className="abono-form" onSubmit={registrar}>
                <label>
                  Fecha
                  <input type="date" value={form.FECHA} onChange={(e) => setForm({ ...form, FECHA: e.target.value })} required />
                </label>
                <label>
                  Monto (S/.)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={saldo}
                    value={form.MONTO}
                    placeholder={saldo.toFixed(2)}
                    onChange={(e) => setForm({ ...form, MONTO: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Medio
                  <select value={form.MEDIO} onChange={(e) => setForm({ ...form, MEDIO: e.target.value })}>
                    {MEDIOS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="abono-form-obs">
                  Observación
                  <input type="text" maxLength={300} value={form.OBSERVACION} onChange={(e) => setForm({ ...form, OBSERVACION: e.target.value })} />
                </label>
                <button type="submit" className="btn-primary" disabled={guardando}>
                  {guardando ? "Registrando…" : "Registrar abono"}
                </button>
              </form>
            )}

            {aviso && <p className={aviso.tipo === "error" ? "field-error" : "gestion-nota"}>{aviso.texto}</p>}

            <TablaGestion
              columnas={columnas}
              filas={abonos}
              totales={{ MONTO: abonos.reduce((s, f) => s + Number(f.MONTO || 0), 0) }}
              vacio="Esta venta aún no tiene pagos registrados."
              claveFila={(f, i) => `${f.IDABONO || "pago"}-${i}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
