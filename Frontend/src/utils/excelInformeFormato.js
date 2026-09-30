/**
 * Formato único de exportación Excel para informes de Academia Vita.
 * Encabezado formal (logo, nombre, eslogan, título, metadatos) listo para gerencia.
 */
import ExcelJS from "exceljs";
import logoUrl from "../images/logo.jpg";

export const ACADEMIA = {
  nombre: "ACADEMIA VITA",
  eslogan: "¡Tu límite es el cosmos!",
  documento: "Documento interno — uso gerencial",
};

export const EXCEL_COLORES = {
  primary: "FF6A42E5",
  primaryDark: "FF5530C9",
  headerBlue: "FF5B9BD5",
  headerDateBlue: "FF2F75B5",
  headerFont: "FFFFFFFF",
  rowEven: "FFDCE6F1",
  rowOdd: "FFFFFFFF",
  border: "FF8EA9DB",
  borderDark: "FF2F5597",
  muted: "FF6B7280",
  text: "FF1C2333",
  softBg: "FFF6F7FB",
  white: "FFFFFFFF",
  black: "FF000000",
};

const LOGO_CACHE = { buffer: null };

export function relleno(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export function borde(estilo = "thin", color = EXCEL_COLORES.border) {
  const b = { style: estilo, color: { argb: color } };
  return { top: b, left: b, bottom: b, right: b };
}

export function aplicarEstilo(cell, { fill, font, alignment, border }) {
  if (fill) cell.fill = fill;
  if (font) cell.font = font;
  if (alignment) cell.alignment = alignment;
  if (border) cell.border = border;
}

export function formatearFechaEmision(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

async function cargarLogoBuffer() {
  if (LOGO_CACHE.buffer) return LOGO_CACHE.buffer;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    LOGO_CACHE.buffer = await res.arrayBuffer();
    return LOGO_CACHE.buffer;
  } catch {
    return null;
  }
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
  const logoBuffer = await cargarLogoBuffer();

  // Filas 1-5: bloque institucional (altura suficiente para el logo)
  ws.getRow(1).height = 20;
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 22;
  ws.getRow(4).height = 28;
  ws.getRow(5).height = 16;

  // Columna A reservada para logo; resto del título
  ws.mergeCells(1, 2, 1, cols);
  ws.mergeCells(2, 2, 2, cols);
  ws.mergeCells(3, 2, 3, cols);
  ws.mergeCells(4, 2, 4, cols);
  ws.mergeCells(5, 2, 5, cols);

  const celdaNombre = ws.getCell(1, 2);
  celdaNombre.value = ACADEMIA.nombre;
  celdaNombre.font = { name: "Calibri", size: 16, bold: true, color: { argb: EXCEL_COLORES.primary } };
  celdaNombre.alignment = { vertical: "middle", horizontal: "left" };

  const celdaEslogan = ws.getCell(2, 2);
  celdaEslogan.value = ACADEMIA.eslogan;
  celdaEslogan.font = { name: "Calibri", size: 10, italic: true, color: { argb: EXCEL_COLORES.muted } };
  celdaEslogan.alignment = { vertical: "middle", horizontal: "left" };

  const celdaTitulo = ws.getCell(3, 2);
  celdaTitulo.value = String(titulo || "").toUpperCase();
  celdaTitulo.font = { name: "Calibri", size: 13, bold: true, color: { argb: EXCEL_COLORES.text } };
  celdaTitulo.alignment = { vertical: "middle", horizontal: "left" };

  const metaParts = [
    ...metadatos.filter(Boolean),
    `Emitido: ${formatearFechaEmision()}`,
    totalRegistros != null ? `Total registros: ${totalRegistros}` : null,
  ].filter(Boolean);

  const celdaMeta = ws.getCell(4, 2);
  celdaMeta.value = metaParts.join("  ·  ");
  celdaMeta.font = { name: "Calibri", size: 9, color: { argb: EXCEL_COLORES.muted } };
  celdaMeta.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  ws.getRow(4).height = 28;

  const celdaDoc = ws.getCell(5, 2);
  celdaDoc.value = subtitulo || ACADEMIA.documento;
  celdaDoc.font = { name: "Calibri", size: 8, color: { argb: EXCEL_COLORES.muted } };
  celdaDoc.alignment = { vertical: "middle", horizontal: "left" };

  // Fondo suave del bloque
  for (let r = 1; r <= 5; r += 1) {
    for (let c = 1; c <= cols; c += 1) {
      const cell = ws.getCell(r, c);
      if (!cell.fill) cell.fill = relleno(EXCEL_COLORES.softBg);
    }
  }

  if (logoBuffer) {
    const imageId = wb.addImage({
      buffer: logoBuffer,
      extension: "jpeg",
    });
    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 64, height: 64 },
      editAs: "oneCell",
    });
  }

  // Fila 6 vacía separadora
  ws.getRow(6).height = 8;

  // Encabezados de tabla empiezan en fila 7
  return 7;
}

export function escribirFilaEncabezados(ws, filaNum, encabezados, { freeze = true } = {}) {
  const row = ws.getRow(filaNum);
  row.height = 28;

  encabezados.forEach((texto, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = texto;
    cell.fill = relleno(EXCEL_COLORES.headerBlue);
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: EXCEL_COLORES.headerFont } };
    cell.border = borde();
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  if (freeze) {
    ws.views = [{ state: "frozen", ySplit: filaNum, xSplit: Math.min(2, encabezados.length) }];
  }

  return row;
}

export function aplicarAnchosColumnas(ws, anchos) {
  anchos.forEach((width, idx) => {
    ws.getColumn(idx + 1).width = width;
  });
}

export function escribirFilaDatos(ws, valores, rowIdx) {
  const fondo = rowIdx % 2 === 1 ? EXCEL_COLORES.rowEven : EXCEL_COLORES.rowOdd;
  const row = ws.addRow(valores);
  row.height = 16;
  valores.forEach((_, colIdx) => {
    const cell = row.getCell(colIdx + 1);
    cell.fill = relleno(fondo);
    cell.font = { name: "Calibri", size: 9, color: { argb: EXCEL_COLORES.black } };
    cell.border = borde();
    cell.alignment = {
      vertical: "middle",
      horizontal: colIdx === 1 ? "left" : "center",
    };
  });
  return row;
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
  wb.lastModifiedBy = ACADEMIA.nombre;
  wb.created = new Date();
  wb.modified = new Date();
  return wb;
}
