import { parseJsonResponse } from "./api";
import { articulosBoleta, numeroBoleta, soles } from "./boletaVenta";
import { dbToView } from "./fecha";
import { whatsappUrl } from "./telefono";

const PLANTILLAS = {
  pago: "/plantillas/recibo-pago.pdf",
  venta: "/plantillas/recibo-venta.pdf",
};

// Coordenadas en puntos medidas desde arriba de la plantilla A4 (iguales a voley 2.0).
const ALTO_PAGINA = 842.04;
const TAMANO = 12;
const SOBRE_LINEA = 14;
const ALTO_FILA = 20.7;
const MAX_FILAS = 9;

const POSICIONES = {
  pago: {
    numero: [491, 80],
    filas: 384,
    montoX: 500,
    total: [500, 574],
  },
  venta: {
    numero: [492, 80],
    filas: 322,
    montoX: 500,
    total: [500, 510],
  },
};

function texto(valor) {
  return String(valor ?? "")
    .toUpperCase()
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "")
    .trim();
}

async function obtener(ruta) {
  const res = await fetch(`/api/${ruta}`);
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || "No se pudo cargar el recibo");
  return data.data;
}

export async function prepararRecibo(tipo, fila) {
  const entidad = tipo === "pago" ? "pagos" : "ventas";
  const id = tipo === "pago" ? fila.IDPAGO : fila.IDVENTA;
  const detalle = await obtener(`${entidad}/${encodeURIComponent(id)}/`);
  const registro = { ...fila, ...detalle, TURNO: fila.TURNO || detalle.TURNO, PERIODO: fila.PERIODO || detalle.PERIODO };
  const [alumna, pagos] = await Promise.all([
    registro.IDALUMNA
      ? obtener(`alumnas/${encodeURIComponent(registro.IDALUMNA)}/`).catch(() => null)
      : null,
    tipo === "venta"
      ? obtener(`ventas/${encodeURIComponent(id)}/abonos/`).then((data) => data?.abonos || []).catch(() => [])
      : [],
  ]);
  return {
    tipo,
    registro,
    alumna,
    pagos,
    numero: tipo === "pago" ? registro.IDPAGO : numeroBoleta(registro),
    nombre: alumna?.NOMBRE || registro.ALUMNA || registro.NOMBRE || "",
    telefono: alumna?.TELAPODERADO || alumna?.TELEFONO || "",
  };
}

function escritor(pagina, fuente) {
  return (valor, x, top, { ancho = 400, alinear = "izquierda", tamano = TAMANO, color } = {}) => {
    let contenido = texto(valor);
    if (!contenido) return;
    let tam = tamano;
    while (tam > 8 && fuente.widthOfTextAtSize(contenido, tam) > ancho) tam -= 0.5;
    while (contenido && fuente.widthOfTextAtSize(contenido, tam) > ancho) contenido = contenido.slice(0, -1);
    const largo = fuente.widthOfTextAtSize(contenido, tam);
    const inicio = alinear === "derecha" ? x - largo : alinear === "centro" ? x - largo / 2 : x;
    pagina.drawText(contenido, { x: inicio, y: ALTO_PAGINA - top - tamano, size: tam, font: fuente, color });
  };
}

function escribirFecha(escribir, fecha) {
  const valor = String(fecha || "");
  if (valor.length !== 8) return;
  escribir(valor.slice(0, 2), 451, 128, { alinear: "centro", ancho: 28 });
  escribir(valor.slice(2, 4), 481, 128, { alinear: "centro", ancho: 28 });
  escribir(valor.slice(4), 521, 128, { alinear: "centro", ancho: 40 });
}

function escribirFilas(escribir, filas, inicioTop, montoX) {
  const visibles = filas.length > MAX_FILAS
    ? [...filas.slice(0, MAX_FILAS - 1), [`Y ${filas.length - MAX_FILAS + 1} conceptos más`, ""]]
    : filas;
  visibles.forEach(([descripcion, monto], indice) => {
    const top = inicioTop + indice * ALTO_FILA;
    escribir(descripcion, 55, top, { ancho: 335 });
    escribir(monto, montoX, top, { alinear: "derecha", ancho: 95 });
  });
}

function datosPago({ registro, alumna }) {
  const periodo = registro.PERIODO ? `Mensualidad ${registro.PERIODO}` : "Mensualidad";
  return {
    campos: [
      [alumna?.NOMBRE || registro.ALUMNA, 105, 184, 300],
      [alumna?.DNI, 465, 184, 75],
      [alumna?.DIRECCION, 115, 214, 425],
      [alumna?.EMAIL, 90, 243, 280],
      [alumna?.TELAPODERADO || alumna?.TELEFONO, 460, 243, 82],
      [alumna?.TURNO, 92, 289 - SOBRE_LINEA, 350],
      [registro.MEDIO, 154, 320 - SOBRE_LINEA, 290],
    ],
    filas: [[periodo, soles(registro.MONTO)]],
    total: registro.MONTO,
  };
}

// Recibo de un abono de la venta: muestra los pagos hasta ese abono y el saldo que quedó.
// Los abonos llegan ordenados por fecha, así que el acumulado es la suma hasta el abono elegido.
export function reciboDeAbono(recibo, abonos, indice) {
  const pagos = abonos.slice(0, indice + 1);
  const pagado = pagos.reduce((suma, fila) => suma + Number(fila.MONTO || 0), 0);
  const saldo = Math.max(Number(recibo.registro.PRECIO || 0) - pagado, 0);
  return { ...recibo, pagos, abono: { ...abonos[indice], PAGADO: pagado, SALDO: saldo } };
}

function etiquetaPago(pago) {
  const tipo = pago.ORIGEN === "Abono" ? "Abono" : "Pago inicial";
  return `${tipo} ${dbToView(String(pago.FECHA || ""))}${pago.MEDIO ? ` - ${pago.MEDIO}` : ""}`;
}

// Si la venta se pagó en partes (o queda saldo), se lista cada pago con el total pagado y el saldo.
function datosVenta({ registro, abono, pagos = [] }) {
  const articulos = articulosBoleta(registro);
  const tallas = [...new Set(articulos.map((item) => item.TALLA).filter(Boolean))];
  const filas = articulos.map((item) => [
    tallas.length > 1 && item.TALLA ? `${item.PRODUCTO} - Talla ${item.TALLA}` : item.PRODUCTO,
    soles(item.PRECIO),
  ]);
  const pagado = abono ? abono.PAGADO : Number(registro.PAGADO || 0);
  const saldo = abono ? abono.SALDO : Number(registro.SALDO || 0);
  if (pagos.length > 1 || saldo > 0) {
    pagos.forEach((pago) => filas.push([etiquetaPago(pago), soles(pago.MONTO)]));
    filas.push([pagos.length ? "Total pagado" : "A cuenta", soles(pagado)], ["Saldo pendiente", soles(saldo)]);
  }
  return {
    campos: [
      [registro.NOMBRE, 115, 198 - SOBRE_LINEA, 290],
      [tallas.length > 1 ? "Varias" : tallas[0], 500, 198.56 - SOBRE_LINEA, 40],
      [registro.OBSERVACION, 150, 227.63 - SOBRE_LINEA, 390],
      [registro.TURNO, 105, 256.69 - SOBRE_LINEA, 265],
    ],
    filas,
    total: registro.PRECIO,
  };
}

export async function pdfRecibo(recibo) {
  const [{ PDFDocument, StandardFonts, rgb }, plantilla] = await Promise.all([
    import("pdf-lib"),
    fetch(PLANTILLAS[recibo.tipo]).then((res) => {
      if (!res.ok) throw new Error("No se encontró la plantilla del recibo");
      return res.arrayBuffer();
    }),
  ]);
  const pdf = await PDFDocument.load(plantilla);
  const pagina = pdf.getPage(0);
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const fuenteNegrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const escribir = escritor(pagina, fuente);
  const posiciones = POSICIONES[recibo.tipo];
  const datos = recibo.tipo === "pago" ? datosPago(recibo) : datosVenta(recibo);

  pagina.drawRectangle({ x: 458, y: ALTO_PAGINA - 178 - TAMANO - 2, width: 35, height: 14, color: rgb(1, 1, 1) });
  escribir(`N° ${recibo.numero}`, ...posiciones.numero, { alinear: "centro", ancho: 92 });
  escribirFecha(escribir, recibo.abono?.FECHA || recibo.registro.FECHA);
  datos.campos.forEach(([valor, x, top, ancho]) => escribir(valor, x, top, { ancho }));
  escribirFilas(escribir, datos.filas, posiciones.filas, posiciones.montoX);
  escribir(soles(datos.total), ...posiciones.total, { alinear: "derecha", ancho: 95 });

  const estado = String(recibo.registro.ESTADO_RECIBO || "").toLowerCase();
  if (estado === "anulado" || estado === "eliminado") {
    const rojo = rgb(0.72, 0.11, 0.11);
    const sello = estado.toUpperCase();
    const ancho = fuenteNegrita.widthOfTextAtSize(sello, 36);
    pagina.drawRectangle({ x: 297 - ancho / 2 - 14, y: 190, width: ancho + 28, height: 52, borderColor: rojo, borderWidth: 3 });
    pagina.drawText(sello, { x: 297 - ancho / 2, y: 204, size: 36, font: fuenteNegrita, color: rojo });
  }

  return pdf.save();
}

export function nombreArchivoRecibo(recibo) {
  return recibo.abono ? `Recibo-${recibo.numero}-${recibo.abono.IDABONO}.pdf` : `Recibo-${recibo.numero}.pdf`;
}

export async function descargarRecibo(recibo) {
  const bytes = await pdfRecibo(recibo);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivoRecibo(recibo);
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function enlaceWhatsappRecibo(recibo, telefono = recibo.telefono) {
  const base = whatsappUrl(telefono);
  if (!base) return null;
  const nombre = String(recibo.nombre || "").trim();
  const { abono } = recibo;
  const detalle = abono
    ? `este es el comprobante de tu pago de ${soles(abono.MONTO)} del recibo N° ${recibo.numero}`
      + (abono.SALDO > 0 ? ` (saldo pendiente: ${soles(abono.SALDO)}). ` : " (pagado por completo). ")
    : `este es tu recibo N° ${recibo.numero}. `;
  const mensaje = `Hola${nombre ? ` ${nombre}` : ""}! Somos VOLEY VITA y ${detalle}`
    + "Gracias por tu pago. Si necesitas algo, escríbenos aquí.";
  return `${base}?text=${encodeURIComponent(mensaje)}`;
}

// La pestaña se abre en el mismo clic: si se abre después de cargar datos, el navegador la bloquea.
// Devuelve enviado = false cuando no hay celular válido, para que se muestre el recibo y se escriba ahí.
export async function enviarReciboPorWhatsapp(cargarRecibo) {
  const ventana = window.open("", "_blank");
  if (ventana) ventana.opener = null;
  try {
    const datos = await cargarRecibo();
    const enlace = enlaceWhatsappRecibo(datos);
    if (!enlace) {
      ventana?.close();
      return { datos, enviado: false };
    }
    if (ventana) ventana.location.href = enlace;
    else window.open(enlace, "_blank", "noopener,noreferrer");
    await descargarRecibo(datos);
    return { datos, enviado: true };
  } catch (err) {
    ventana?.close();
    throw err;
  }
}
