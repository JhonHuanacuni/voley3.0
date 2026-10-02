import { dbToView } from "./fecha";

const WINANSI = {
  á: "\\341",
  é: "\\351",
  í: "\\355",
  ó: "\\363",
  ú: "\\372",
  Á: "\\301",
  É: "\\311",
  Í: "\\315",
  Ó: "\\323",
  Ú: "\\332",
  ñ: "\\361",
  Ñ: "\\321",
  ü: "\\374",
  Ü: "\\334",
  "¿": "\\277",
  "¡": "\\241",
};

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

function pdfTexto(valor) {
  return String(valor ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, (ch) => WINANSI[ch] || "");
}

function partir(texto, max) {
  const palabras = String(texto || "—").split(/\s+/);
  const lineas = [];
  let actual = "";
  palabras.forEach((palabra) => {
    const siguiente = actual ? `${actual} ${palabra}` : palabra;
    if (siguiente.length > max && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = siguiente;
    }
  });
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : ["—"];
}

export function descargarBoletaPdf(venta) {
  const numero = numeroBoleta(venta);
  const comandos = [];
  let y = 760;
  const texto = (contenido, tamano, x = 48) => {
    comandos.push(`BT /F1 ${tamano} Tf ${x} ${y} Td (${pdfTexto(contenido)}) Tj ET`);
    y -= tamano + 6;
  };
  texto("ACADEMIA VITA", 16, 48);
  texto("BOLETA DE VENTA", 13, 48);
  y -= 6;
  texto(`Nro. ${numero}`, 11, 48);
  texto(`Fecha ${fechaBoleta(venta)}`, 11, 48);
  y -= 8;
  lineasBoleta(venta).forEach(([etiqueta, valor]) => {
    partir(`${etiqueta}: ${valor}`, 62).forEach((linea) => texto(linea, 11, 48));
  });
  y -= 8;
  const fila = (izq, der, tamano) => {
    comandos.push(`BT /F1 ${tamano} Tf 48 ${y} Td (${pdfTexto(izq)}) Tj ET`);
    comandos.push(`BT /F1 ${tamano} Tf 280 ${y} Td (${pdfTexto(der)}) Tj ET`);
    y -= tamano + 6;
  };
  fila("Producto", "Importe", 11);
  articulosBoleta(venta).forEach((item) => {
    const nombre = item.TALLA ? `${item.PRODUCTO} (${item.TALLA})` : item.PRODUCTO;
    partir(nombre, 28).forEach((linea, indice) => {
      fila(linea, indice === 0 ? soles(item.PRECIO) : "", 11);
    });
  });
  y -= 6;
  texto(`TOTAL ${soles(venta?.PRECIO)}`, 14, 48);
  const estado = String(venta?.ESTADO_RECIBO || "").toLowerCase();
  if (estado === "anulado" || estado === "eliminado") {
    y -= 8;
    texto(estado === "anulado" ? "ANULADO" : "ELIMINADO", 14, 48);
  }
  sellosBoleta(venta).forEach(([etiqueta, valor]) => {
    partir(`${etiqueta}: ${valor}`, 62).forEach((linea) => texto(linea, 10, 48));
  });
  if (venta?.TIPO === "Servicio") {
    y -= 10;
    texto("Documento interno. No modifica la mensualidad.", 9, 48);
  }

  const stream = comandos.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `Boleta-${numero}.pdf`;
  enlace.click();
  URL.revokeObjectURL(url);
}
