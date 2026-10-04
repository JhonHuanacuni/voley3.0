/**
 * Formato único de exportación Excel para informes de Academia Vita.
 * Encabezado institucional con logo, título, filtros aplicados y datos de emisión, listo para gerencia.
 */
import ExcelJS from "exceljs";
import { ACADEMIA, MARCA, argb, cargarLogo, formatearFechaEmision, usuarioSesion } from "./informeMarca";

export { ACADEMIA, formatearFechaEmision };

const FUENTE = "Calibri";
const FORMATO_MONEDA = '"S/" #,##0.00';
const FILA_ENCABEZADOS = 10;

export function relleno(hex) {
  return { type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } };
}

export function borde(estilo = "thin", color = MARCA.linea) {
  const b = { style: estilo, color: { argb: argb(color) } };
  return { top: b, left: b, bottom: b, right: b };
}

function pintarFila(ws, fila, columnas, hex) {
  for (let c = 1; c <= columnas; c += 1) ws.getCell(fila, c).fill = relleno(hex);
}

function celdaUnida(ws, fila, desde, hasta, valor, font, alignment = {}) {
  if (hasta > desde) ws.mergeCells(fila, desde, fila, hasta);
  const cell = ws.getCell(fila, desde);
  cell.value = valor;
  cell.font = { name: FUENTE, ...font };
  cell.alignment = { vertical: "middle", horizontal: "left", ...alignment };
  return cell;
}

/**
 * Inserta el encabezado institucional.
 * @returns {Promise<number>} fila (1-based) donde deben ir los encabezados de columnas
 */
export async function escribirEncabezadoInforme(wb, ws, {
  titulo,
  subtitulo = "",
  metadatos = [],
  totalColumnas = 8,
  totalRegistros = null,
}) {
  const cols = Math.max(totalColumnas, 4);
  const logo = await cargarLogo();

  [24, 17, 17, 4, 8, 28, 22, 18, 8].forEach((alto, i) => {
    ws.getRow(i + 1).height = alto;
  });

  [1, 2, 3].forEach((fila) => pintarFila(ws, fila, cols, MARCA.primario));
  pintarFila(ws, 4, cols, MARCA.oscuro);

  celdaUnida(ws, 1, 2, cols, ACADEMIA.nombre, { size: 18, bold: true, color: { argb: argb(MARCA.blanco) } }, { vertical: "bottom" });
  celdaUnida(ws, 2, 2, cols, ACADEMIA.eslogan, { size: 10, italic: true, color: { argb: argb(MARCA.blanco) } });
  celdaUnida(ws, 3, 2, cols, subtitulo || ACADEMIA.documento, { size: 9, color: { argb: argb(MARCA.suave) } });

  const celdaTitulo = celdaUnida(ws, 6, 1, cols, String(titulo || "Reporte").toUpperCase(), {
    size: 15,
    bold: true,
    color: { argb: argb(MARCA.oscuro) },
  });
  celdaTitulo.border = { bottom: { style: "medium", color: { argb: argb(MARCA.primario) } } };

  const filtros = metadatos.filter(Boolean);
  celdaUnida(ws, 7, 1, cols, filtros.length ? filtros.join("   •   ") : "Sin filtros aplicados", {
    size: 10,
    color: { argb: argb(MARCA.texto) },
  }, { wrapText: true, indent: 1 });
  pintarFila(ws, 7, cols, MARCA.suave);

  const emision = [
    `Emitido: ${formatearFechaEmision()}`,
    usuarioSesion() ? `Generado por: ${usuarioSesion()}` : null,
    totalRegistros != null ? `Total de registros: ${totalRegistros}` : null,
  ].filter(Boolean);
  celdaUnida(ws, 8, 1, cols, emision.join("   •   "), { size: 9, italic: true, color: { argb: argb(MARCA.gris) } }, { indent: 1 });

  if (logo) {
    const imageId = wb.addImage({ buffer: logo.buffer, extension: "jpeg" });
    const alto = 62;
    ws.addImage(imageId, {
      tl: { col: 0.15, row: 0.2 },
      ext: { width: Math.round((alto * logo.ancho) / logo.alto), height: alto },
      editAs: "oneCell",
    });
  }

  return FILA_ENCABEZADOS;
}

export function escribirFilaEncabezados(ws, filaNum, encabezados, { freeze = true } = {}) {
  const row = ws.getRow(filaNum);
  row.height = 30;
  encabezados.forEach((texto, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = texto;
    cell.fill = relleno(MARCA.medio);
    cell.font = { name: FUENTE, size: 10, bold: true, color: { argb: argb(MARCA.blanco) } };
    cell.border = borde("thin", MARCA.oscuro);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  if (freeze) ws.views = [{ state: "frozen", ySplit: filaNum, showGridLines: false }];
  ws.autoFilter = { from: { row: filaNum, column: 1 }, to: { row: filaNum, column: encabezados.length } };
  return row;
}

export function aplicarAnchosColumnas(ws, anchos) {
  anchos.forEach((width, idx) => {
    ws.getColumn(idx + 1).width = idx === 0 ? Math.max(width, 12) : width;
  });
}

function alinear(valor, formato) {
  if (formato === "moneda" || formato === "entero" || typeof valor === "number") return "right";
  if (formato === "fecha") return "center";
  return "left";
}

/** `formatos` es opcional: uno por columna ("moneda", "entero", "fecha", "texto"). */
export function escribirFilaDatos(ws, valores, rowIdx, formatos = []) {
  const fondo = rowIdx % 2 === 1 ? MARCA.zebra : MARCA.blanco;
  const row = ws.addRow(valores);
  row.height = 18;
  valores.forEach((valor, colIdx) => {
    const cell = row.getCell(colIdx + 1);
    cell.fill = relleno(fondo);
    cell.font = { name: FUENTE, size: 10, color: { argb: argb(MARCA.texto) } };
    cell.border = borde("hair");
    cell.alignment = { vertical: "middle", horizontal: alinear(valor, formatos[colIdx]), indent: 1 };
    if (formatos[colIdx] === "moneda") cell.numFmt = FORMATO_MONEDA;
  });
  return row;
}

export function escribirFilaTotales(ws, valores, formatos = []) {
  const row = ws.addRow(valores);
  row.height = 22;
  valores.forEach((valor, colIdx) => {
    const cell = row.getCell(colIdx + 1);
    cell.fill = relleno(MARCA.suave);
    cell.font = { name: FUENTE, size: 10.5, bold: true, color: { argb: argb(MARCA.oscuro) } };
    cell.border = {
      top: { style: "medium", color: { argb: argb(MARCA.primario) } },
      bottom: { style: "medium", color: { argb: argb(MARCA.primario) } },
    };
    cell.alignment = { vertical: "middle", horizontal: colIdx === 0 ? "left" : alinear(valor, formatos[colIdx]), indent: 1 };
    if (formatos[colIdx] === "moneda") cell.numFmt = FORMATO_MONEDA;
  });
  return row;
}

/** Nota de confidencialidad, pie de página y ajustes de impresión (A4 horizontal, encabezados repetidos). */
export function cerrarInforme(ws, { totalColumnas, filaEncabezado = FILA_ENCABEZADOS }) {
  const cols = Math.max(totalColumnas, 4);
  ws.addRow([]);
  const fila = ws.addRow([]).number;
  celdaUnida(ws, fila, 1, cols, ACADEMIA.confidencial, { size: 8, italic: true, color: { argb: argb(MARCA.gris) } });

  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printTitlesRow: `${filaEncabezado}:${filaEncabezado}`,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 },
  };
  ws.headerFooter = {
    oddFooter: `&L&8${ACADEMIA.nombre} · ${ACADEMIA.documento}&R&8Página &P de &N`,
  };
}

export function descargarBufferExcel(buffer, nombreArchivo) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

export async function crearWorkbookInforme() {
  const wb = new ExcelJS.Workbook();
  wb.creator = ACADEMIA.nombre;
  wb.lastModifiedBy = usuarioSesion() || ACADEMIA.nombre;
  wb.created = new Date();
  wb.modified = new Date();
  return wb;
}
