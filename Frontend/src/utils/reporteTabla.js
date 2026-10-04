import { dbToView } from "./fecha";
import { soles } from "./reporteVentas";
import { descargarPdfInforme } from "./pdfInforme";
import {
  aplicarAnchosColumnas,
  cerrarInforme,
  crearWorkbookInforme,
  descargarBufferExcel,
  escribirEncabezadoInforme,
  escribirFilaDatos,
  escribirFilaEncabezados,
  escribirFilaTotales,
} from "./excelInformeFormato";

export function valorCelda(valor, formato) {
  if (valor == null || valor === "") return "";
  if (formato === "fecha") return dbToView(String(valor));
  if (formato === "moneda") return soles(valor);
  return String(valor);
}

const COLUMNAS_MAYUSCULAS = new Set(["ALUMNA", "NOMBRE", "CICLO", "APODERADO"]);

/** Texto de una celda; los nombres de personas y categorías van siempre en mayúsculas. */
export function textoCelda(fila, col) {
  const texto = valorCelda(fila[col.key], col.formato);
  return COLUMNAS_MAYUSCULAS.has(col.key) ? texto.toUpperCase() : texto;
}

function resumenTotales(columnas, filas, totales) {
  const montos = columnas
    .filter((col) => col.formato === "moneda" && totales[col.key] != null)
    .slice(0, 4)
    .map((col) => ({ etiqueta: col.label, valor: soles(totales[col.key]) }));
  return [{ etiqueta: "Registros", valor: String(filas.length) }, ...montos];
}

export async function exportarTabla({ titulo, metadatos = [], columnas, filas, totales = {}, archivo, formato = "excel" }) {
  const hayTotales = Object.keys(totales || {}).length > 0;
  const filaTotales = (texto) => columnas.map((col, i) => {
    if (i === 0) return "TOTAL";
    const valor = totales[col.key];
    if (valor == null) return texto ? "" : null;
    return texto ? valorCelda(valor, col.formato) : Number(valor);
  });

  if (formato === "pdf") {
    await descargarPdfInforme({
      titulo,
      metadatos,
      columnas,
      filas: filas.map((fila) => columnas.map((col) => textoCelda(fila, col))),
      totales: hayTotales ? filaTotales(true) : null,
      resumen: hayTotales ? resumenTotales(columnas, filas, totales) : [],
      archivo,
    });
    return;
  }

  const formatos = columnas.map((col) => col.formato);
  const wb = await crearWorkbookInforme();
  const ws = wb.addWorksheet(String(titulo || "Reporte").replace(/[\\/?*[\]:]/g, " ").slice(0, 30));
  const filaEncabezado = await escribirEncabezadoInforme(wb, ws, {
    titulo,
    metadatos,
    totalColumnas: columnas.length,
    totalRegistros: filas.length,
  });
  escribirFilaEncabezados(ws, filaEncabezado, columnas.map((c) => c.label));
  filas.forEach((fila, indice) => {
    escribirFilaDatos(ws, columnas.map((col) => {
      const valor = fila[col.key];
      if (col.formato === "moneda" || col.formato === "entero") return valor == null || valor === "" ? null : Number(valor);
      return textoCelda(fila, col);
    }), indice, formatos);
  });
  if (hayTotales) escribirFilaTotales(ws, filaTotales(false), formatos);
  aplicarAnchosColumnas(ws, columnas.map((col) => {
    const largo = filas.reduce((max, fila) => Math.max(max, valorCelda(fila[col.key], col.formato).length), String(col.label).length);
    return Math.min(Math.max(largo + 4, 10), 48);
  }));
  cerrarInforme(ws, { totalColumnas: columnas.length, filaEncabezado });
  const buffer = await wb.xlsx.writeBuffer();
  descargarBufferExcel(buffer, `${archivo}.xlsx`);
}
