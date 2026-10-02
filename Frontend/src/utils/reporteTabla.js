import { dbToView } from "./fecha";
import { descargarPdf, documentoPdf, pdfTexto, recortar, soles } from "./reporteVentas";
import {
  aplicarAnchosColumnas,
  crearWorkbookInforme,
  descargarBufferExcel,
  escribirEncabezadoInforme,
  escribirFilaDatos,
  escribirFilaEncabezados,
} from "./excelInformeFormato";

const ANCHO_BASE = { fecha: 10, moneda: 11, entero: 7, texto: 22 };

export function valorCelda(valor, formato) {
  if (valor == null || valor === "") return "";
  if (formato === "fecha") return dbToView(String(valor));
  if (formato === "moneda") return soles(valor);
  return String(valor);
}

function anchosRelativos(columnas) {
  return columnas.map((col) => ANCHO_BASE[col.formato] || ANCHO_BASE.texto);
}

function paginasPdf({ titulo, subtitulo, columnas, filas, totales }) {
  const izquierda = 28;
  const anchoUtil = 786;
  const tamano = columnas.length > 9 ? 6.5 : 7.5;
  const anchoLetra = tamano * 0.5;
  const relativos = anchosRelativos(columnas);
  const suma = relativos.reduce((a, b) => a + b, 0);
  let x = izquierda;
  const posiciones = relativos.map((ancho) => {
    const puntos = (ancho / suma) * anchoUtil;
    const pos = { x, max: Math.max(4, Math.floor((puntos - 4) / anchoLetra)) };
    x += puntos;
    return pos;
  });

  const porPagina = 38;
  const filasTotales = Object.keys(totales || {}).length ? 1 : 0;
  const cantidad = Math.max(1, Math.ceil((filas.length + filasTotales) / porPagina));
  const paginas = [];
  for (let indice = 0; indice < cantidad; indice += 1) {
    const comandos = [];
    const texto = (contenido, tam, px, py) => {
      comandos.push(`BT /F1 ${tam} Tf ${px.toFixed(1)} ${py} Td (${pdfTexto(contenido)}) Tj ET`);
    };
    texto("ACADEMIA VITA", 14, izquierda, 560);
    texto(String(titulo || "").toUpperCase(), 11, izquierda, 542);
    texto(subtitulo, 8.5, izquierda, 526);
    texto(`Pagina ${indice + 1} de ${cantidad}`, 8, 740, 526);
    let y = 504;
    columnas.forEach((col, i) => texto(recortar(col.label, posiciones[i].max), tamano, posiciones[i].x, y));
    y -= 13;
    filas.slice(indice * porPagina, (indice + 1) * porPagina).forEach((fila) => {
      columnas.forEach((col, i) => {
        texto(recortar(valorCelda(fila[col.key], col.formato), posiciones[i].max), tamano, posiciones[i].x, y);
      });
      y -= 12;
    });
    if (indice === cantidad - 1 && filasTotales) {
      y -= 4;
      columnas.forEach((col, i) => {
        if (i === 0) texto("TOTAL", tamano, posiciones[i].x, y);
        else if (totales[col.key] != null) {
          texto(recortar(valorCelda(totales[col.key], col.formato), posiciones[i].max), tamano, posiciones[i].x, y);
        }
      });
    }
    paginas.push(comandos.join("\n"));
  }
  return paginas;
}

export async function exportarTabla({ titulo, metadatos = [], columnas, filas, totales = {}, archivo, formato = "excel" }) {
  const subtitulo = [...metadatos, `${filas.length} registros`].join("  |  ");
  if (formato === "pdf") {
    descargarPdf(documentoPdf(paginasPdf({ titulo, subtitulo, columnas, filas, totales })), `${archivo}.pdf`);
    return;
  }
  const wb = await crearWorkbookInforme();
  const ws = wb.addWorksheet(String(titulo || "Reporte").slice(0, 30));
  const filaEncabezado = await escribirEncabezadoInforme(wb, ws, {
    titulo,
    metadatos,
    totalColumnas: columnas.length,
    totalRegistros: filas.length,
  });
  escribirFilaEncabezados(ws, filaEncabezado, columnas.map((c) => c.label));
  filas.forEach((fila, indice) => {
    const fil = escribirFilaDatos(ws, columnas.map((col) => {
      const valor = fila[col.key];
      if (col.formato === "moneda" || col.formato === "entero") return valor == null || valor === "" ? null : Number(valor);
      return valorCelda(valor, col.formato);
    }), indice);
    columnas.forEach((col, i) => {
      if (col.formato === "moneda") fil.getCell(i + 1).numFmt = '"S/" #,##0.00';
    });
  });
  if (Object.keys(totales).length) {
    const fila = ws.addRow(columnas.map((col, i) => (i === 0 ? "TOTAL" : totales[col.key] ?? null)));
    fila.font = { bold: true };
    columnas.forEach((col, i) => {
      if (col.formato === "moneda") fila.getCell(i + 1).numFmt = '"S/" #,##0.00';
    });
  }
  aplicarAnchosColumnas(ws, anchosRelativos(columnas).map((ancho) => Math.round(ancho * 1.3)));
  const buffer = await wb.xlsx.writeBuffer();
  descargarBufferExcel(buffer, `${archivo}.xlsx`);
}
