import { dbToView } from "./fecha";
import { ACADEMIA, MARCA, cargarLogo, formatearFechaEmision, rgb } from "./informeMarca";

export function numeroBoleta(venta) {
  return String(venta?.NUMERO || venta?.COMPROBANTE || venta?.IDVENTA || "S/N");
}

function traza(fecha, hora, usuario) {
  const dia = dbToView(String(fecha || ""));
  return [dia, hora, usuario].filter(Boolean).join(" · ");
}

export function sellosBoleta(venta) {
  const filas = [];
  const emitido = traza(venta?.FECHA_EMISION, venta?.HORA_EMISION, venta?.USUARIO_EMISION);
  if (emitido) filas.push(["Emitido", emitido]);
  const modificado = traza(venta?.FECHA_MODIFICACION, venta?.HORA_MODIFICACION, venta?.USUARIO_MODIFICACION);
  if (modificado) filas.push(["Modificado", modificado]);
  const estado = String(venta?.ESTADO_RECIBO || "").toLowerCase();
  if (estado === "anulado") {
    filas.push(["Anulado", traza(venta?.FECHA_ANULACION, venta?.HORA_ANULACION, venta?.USUARIO_ANULACION) || "—"]);
  }
  if (estado === "eliminado") {
    filas.push(["Eliminado", traza(venta?.FECHA_ELIMINACION, venta?.HORA_ELIMINACION, venta?.USUARIO_ELIMINACION) || "—"]);
  }
  return filas;
}

export function soles(valor) {
  const n = Number(valor);
  const monto = Number.isNaN(n) ? 0 : n;
  return `S/ ${monto.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fechaBoleta(venta) {
  return dbToView(String(venta?.FECHA || "")) || "—";
}

export function lineasBoleta(venta) {
  const filas = [
    ["Cliente", venta?.NOMBRE || "—"],
    ["Tipo", venta?.TIPO || "—"],
  ];
  if (venta?.TURNO) filas.push(["Turno", venta.TURNO]);
  filas.push(["Medio de pago", venta?.MEDIO || "—"]);
  if (venta?.OBSERVACION) filas.push(["Observación", venta.OBSERVACION]);
  return filas;
}

export function articulosBoleta(venta) {
  const detalle = Array.isArray(venta?.DETALLE) ? venta.DETALLE.filter((item) => item?.PRODUCTO) : [];
  if (detalle.length) return detalle;
  if (venta?.PRODUCTO) {
    return [{ PRODUCTO: venta.PRODUCTO, TALLA: venta.TALLA, PRECIO: venta.PRECIO }];
  }
  return [];
}

export async function descargarBoletaPdf(venta) {
  const [{ jsPDF }, moduloTabla, logo] = await Promise.all([import("jspdf"), import("jspdf-autotable"), cargarLogo()]);
  const autoTable = moduloTabla.autoTable || moduloTabla.default;
  const numero = numeroBoleta(venta);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a5" });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 28;
  doc.setProperties({ title: `Boleta ${numero}`, author: ACADEMIA.nombre, creator: ACADEMIA.nombre });

  doc.setFillColor(...rgb(MARCA.primario));
  doc.rect(0, 0, ancho, 74, "F");
  doc.setFillColor(...rgb(MARCA.oscuro));
  doc.rect(0, 74, ancho, 3, "F");
  let xTexto = margen;
  if (logo) {
    const altoLogo = 52;
    const anchoLogo = (altoLogo * logo.ancho) / logo.alto;
    doc.setFillColor(...rgb(MARCA.blanco));
    doc.roundedRect(margen, 11, anchoLogo + 6, altoLogo + 4, 5, 5, "F");
    doc.addImage(logo.dataUrl, "JPEG", margen + 3, 13, anchoLogo, altoLogo);
    xTexto = margen + anchoLogo + 16;
  }
  doc.setTextColor(...rgb(MARCA.blanco));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(ACADEMIA.nombre, xTexto, 34);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.text(ACADEMIA.eslogan, xTexto, 48);

  const y0 = 96;
  doc.setDrawColor(...rgb(MARCA.primario));
  doc.setLineWidth(1.2);
  doc.roundedRect(ancho - margen - 130, y0 - 12, 130, 44, 5, 5, "S");
  doc.setTextColor(...rgb(MARCA.oscuro));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("BOLETA DE VENTA", ancho - margen - 65, y0 + 3, { align: "center" });
  doc.setFontSize(12);
  doc.text(`N° ${numero}`, ancho - margen - 65, y0 + 21, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(MARCA.gris));
  doc.text("Fecha de emisión", margen, y0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...rgb(MARCA.texto));
  doc.text(fechaBoleta(venta), margen, y0 + 15);

  const estiloBase = { font: "helvetica", textColor: rgb(MARCA.texto), lineColor: rgb(MARCA.linea), lineWidth: 0.4 };
  autoTable(doc, {
    body: lineasBoleta(venta),
    startY: y0 + 46,
    margin: { left: margen, right: margen },
    theme: "plain",
    styles: { ...estiloBase, fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 6, right: 6 } },
    columnStyles: { 0: { cellWidth: 92, textColor: rgb(MARCA.gris) }, 1: { fontStyle: "bold" } },
    alternateRowStyles: { fillColor: rgb(MARCA.zebra) },
  });

  const articulos = articulosBoleta(venta);
  autoTable(doc, {
    head: [["Producto o servicio", "Talla", "Importe"]],
    body: articulos.length
      ? articulos.map((item) => [item.PRODUCTO, item.TALLA || "—", soles(item.PRECIO)])
      : [[{ content: "Sin detalle", colSpan: 3, styles: { halign: "center" } }]],
    foot: [[{ content: "TOTAL", colSpan: 2 }, { content: soles(venta?.PRECIO), styles: { halign: "right" } }]],
    startY: doc.lastAutoTable.finalY + 14,
    margin: { left: margen, right: margen, bottom: 60 },
    theme: "grid",
    styles: { ...estiloBase, fontSize: 9, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: rgb(MARCA.medio), textColor: rgb(MARCA.blanco), fontStyle: "bold", lineColor: rgb(MARCA.oscuro) },
    footStyles: { fillColor: rgb(MARCA.suave), textColor: rgb(MARCA.oscuro), fontStyle: "bold", fontSize: 11 },
    columnStyles: { 1: { halign: "center", cellWidth: 52 }, 2: { halign: "right", cellWidth: 82 } },
  });

  let y = doc.lastAutoTable.finalY + 22;
  const estado = String(venta?.ESTADO_RECIBO || "").toLowerCase();
  if (estado === "anulado" || estado === "eliminado") {
    doc.setDrawColor(185, 28, 28);
    doc.setTextColor(185, 28, 28);
    doc.setLineWidth(2);
    doc.roundedRect(ancho / 2 - 70, y - 16, 140, 30, 4, 4, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(estado.toUpperCase(), ancho / 2, y + 5, { align: "center" });
    y += 32;
  }

  const sellos = sellosBoleta(venta);
  if (sellos.length) {
    doc.setFontSize(8);
    sellos.forEach(([etiqueta, valor]) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...rgb(MARCA.gris));
      doc.text(`${etiqueta}:`, margen, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(valor), margen + 56, y);
      y += 12;
    });
  }
  if (venta?.TIPO === "Servicio") {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...rgb(MARCA.gris));
    doc.text("Documento interno de la academia. No modifica la mensualidad.", margen, y + 4);
  }

  doc.setDrawColor(...rgb(MARCA.linea));
  doc.setLineWidth(0.6);
  doc.line(margen, alto - 42, ancho - margen, alto - 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...rgb(MARCA.oscuro));
  doc.text(`Gracias por confiar en ${ACADEMIA.nombre}`, ancho / 2, alto - 28, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...rgb(MARCA.gris));
  doc.text(`Documento generado el ${formatearFechaEmision()}`, ancho / 2, alto - 16, { align: "center" });

  doc.save(`Boleta-${numero}.pdf`);
}
