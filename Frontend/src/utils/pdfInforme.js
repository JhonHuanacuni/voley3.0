import { ACADEMIA, MARCA, cargarLogo, formatearFechaEmision, rgb, usuarioSesion } from "./informeMarca";

const ANCHO = 842;
const ALTO = 595;
const MARGEN = 32;
const ALINEACION = { moneda: "right", entero: "right", fecha: "center" };

function encabezadoPrincipal(doc, { titulo, metadatos, totalRegistros, logo }) {
  doc.setFillColor(...rgb(MARCA.primario));
  doc.rect(0, 0, ANCHO, 80, "F");
  doc.setFillColor(...rgb(MARCA.oscuro));
  doc.rect(0, 80, ANCHO, 4, "F");

  let xTexto = MARGEN;
  if (logo) {
    const alto = 58;
    const ancho = (alto * logo.ancho) / logo.alto;
    doc.setFillColor(...rgb(MARCA.blanco));
    doc.roundedRect(MARGEN, 11, ancho + 8, alto + 4, 6, 6, "F");
    doc.addImage(logo.dataUrl, "JPEG", MARGEN + 4, 13, ancho, alto);
    xTexto = MARGEN + ancho + 22;
  }

  doc.setTextColor(...rgb(MARCA.blanco));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(ACADEMIA.nombre, xTexto, 36);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text(ACADEMIA.eslogan, xTexto, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...rgb(MARCA.suave));
  doc.text(ACADEMIA.documento, xTexto, 66);

  const derecha = ANCHO - MARGEN;
  const emision = [
    `Emitido: ${formatearFechaEmision()}`,
    usuarioSesion() ? `Generado por: ${usuarioSesion()}` : null,
    `Total de registros: ${totalRegistros}`,
  ].filter(Boolean);
  doc.setTextColor(...rgb(MARCA.blanco));
  doc.setFontSize(9);
  emision.forEach((linea, i) => doc.text(linea, derecha, 34 + i * 14, { align: "right" }));

  doc.setTextColor(...rgb(MARCA.oscuro));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(String(titulo || "Reporte").toUpperCase(), MARGEN, 114);
  doc.setDrawColor(...rgb(MARCA.primario));
  doc.setLineWidth(2.2);
  doc.line(MARGEN, 122, MARGEN + 90, 122);

  let y = 138;
  let x = MARGEN;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const filtros = metadatos.filter(Boolean);
  (filtros.length ? filtros : ["Sin filtros aplicados"]).forEach((texto) => {
    const ancho = doc.getTextWidth(texto) + 16;
    if (x + ancho > ANCHO - MARGEN) {
      x = MARGEN;
      y += 20;
    }
    doc.setFillColor(...rgb(MARCA.suave));
    doc.roundedRect(x, y, ancho, 15, 7, 7, "F");
    doc.setTextColor(...rgb(MARCA.texto));
    doc.text(texto, x + 8, y + 10.5);
    x += ancho + 6;
  });
  return y + 26;
}

function tarjetasResumen(doc, resumen, y) {
  if (!resumen.length) return y;
  const tarjetas = resumen.slice(0, 5);
  const espacio = 10;
  const ancho = (ANCHO - MARGEN * 2 - espacio * (tarjetas.length - 1)) / tarjetas.length;
  tarjetas.forEach(({ etiqueta, valor }, i) => {
    const x = MARGEN + i * (ancho + espacio);
    doc.setFillColor(...rgb(MARCA.blanco));
    doc.setDrawColor(...rgb(MARCA.linea));
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, ancho, 44, 5, 5, "FD");
    doc.setFillColor(...rgb(MARCA.primario));
    doc.rect(x, y + 6, 3, 32, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...rgb(MARCA.gris));
    doc.text(String(etiqueta).toUpperCase(), x + 12, y + 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...rgb(MARCA.oscuro));
    doc.text(String(valor), x + 12, y + 34);
  });
  return y + 58;
}

function marcoPaginas(doc, titulo) {
  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina += 1) {
    doc.setPage(pagina);
    if (pagina > 1) {
      doc.setFillColor(...rgb(MARCA.primario));
      doc.rect(0, 0, ANCHO, 28, "F");
      doc.setFillColor(...rgb(MARCA.oscuro));
      doc.rect(0, 28, ANCHO, 2, "F");
      doc.setTextColor(...rgb(MARCA.blanco));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(ACADEMIA.nombre, MARGEN, 18.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(String(titulo || "").toUpperCase(), ANCHO - MARGEN, 18.5, { align: "right" });
    }
    doc.setDrawColor(...rgb(MARCA.linea));
    doc.setLineWidth(0.6);
    doc.line(MARGEN, ALTO - 30, ANCHO - MARGEN, ALTO - 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...rgb(MARCA.gris));
    doc.text(`${ACADEMIA.nombre} · ${ACADEMIA.documento}`, MARGEN, ALTO - 18);
    doc.text(ACADEMIA.confidencial, ANCHO / 2, ALTO - 18, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...rgb(MARCA.oscuro));
    doc.text(`Página ${pagina} de ${total}`, ANCHO - MARGEN, ALTO - 18, { align: "right" });
  }
}

/**
 * PDF A4 horizontal con la identidad de la academia.
 * `filas` y `totales` llegan ya formateados como texto, en el mismo orden que `columnas`.
 */
export async function descargarPdfInforme({ titulo, metadatos = [], columnas, filas, totales = null, resumen = [], archivo }) {
  const [{ jsPDF }, moduloTabla, logo] = await Promise.all([import("jspdf"), import("jspdf-autotable"), cargarLogo()]);
  const autoTable = moduloTabla.autoTable || moduloTabla.default;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setProperties({ title: String(titulo || "Reporte"), author: ACADEMIA.nombre, creator: ACADEMIA.nombre });

  let y = encabezadoPrincipal(doc, { titulo, metadatos, totalRegistros: filas.length, logo });
  y = tarjetasResumen(doc, resumen, y);

  const columnStyles = Object.fromEntries(columnas.map((col, i) => [i, { halign: ALINEACION[col.formato] || "left" }]));
  const cuerpo = filas.length
    ? filas
    : [[{ content: "No hay registros para los filtros elegidos.", colSpan: columnas.length, styles: { halign: "center", textColor: rgb(MARCA.gris) } }]];

  autoTable(doc, {
    head: [columnas.map((c) => c.label)],
    body: cuerpo,
    foot: totales ? [totales.map((valor, i) => ({ content: valor ?? "", styles: { halign: i === 0 ? "left" : ALINEACION[columnas[i].formato] || "left" } }))] : undefined,
    startY: y,
    margin: { top: 44, left: MARGEN, right: MARGEN, bottom: 42 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: columnas.length > 9 ? 7 : 8,
      cellPadding: { top: 4.5, bottom: 4.5, left: 5, right: 5 },
      textColor: rgb(MARCA.texto),
      lineColor: rgb(MARCA.linea),
      lineWidth: 0.4,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: { fillColor: rgb(MARCA.medio), textColor: rgb(MARCA.blanco), fontStyle: "bold", halign: "center", lineColor: rgb(MARCA.oscuro) },
    alternateRowStyles: { fillColor: rgb(MARCA.zebra) },
    footStyles: { fillColor: rgb(MARCA.suave), textColor: rgb(MARCA.oscuro), fontStyle: "bold", lineColor: rgb(MARCA.primario) },
    columnStyles,
    showHead: "everyPage",
    showFoot: "lastPage",
  });

  marcoPaginas(doc, titulo);
  doc.save(`${archivo}.pdf`);
}
