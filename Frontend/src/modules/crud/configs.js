import { dbToInput, primerDiaMesInput, ultimoDiaMesInput } from "../../utils/fecha";
import { OPERACIONES_AUDITORIA, TABLAS_AUDITORIA } from "../../utils/auditoria";
import { parseJsonResponse } from "../../utils/api";
import { abrirEstadoCuenta } from "../../utils/estadoCuenta";

const MEDIOS = ["Efectivo", "Transferencia", "Tarjeta", "Yape", "Plin", "Otro"];
const GENEROS = ["Mujer", "Hombre"];
const CONDICIONES = ["Regular", "Becado", "1/2 beca"];
const TALLAS = ["XS", "S", "M", "L"];
const PRODUCTOS_FISICOS = [
  "Camisetas",
  "Falda short",
  "Short",
  "Medias deportivas",
  "Rodilleras",
  "Mangas",
  "Poleras",
  "Otros implementos deportivos",
];
const SERVICIOS = [
  "Clases individuales",
  "Otros servicios o conceptos que pueda comercializar la academia",
];
const ESTADOS_ALUMNA = ["Activa", "Inactiva", "Retirada"];
const FUNCIONES_POR_DEFECTO = [
  "REGISTRAR_ALUMNAS",
  "REGISTRAR_MATRICULAS",
  "REGISTRAR_MENSUALIDADES",
  "REGISTRAR_VENTAS",
  "EMITIR_RECIBOS",
  "EMITIR_BOLETAS",
  "VER_REPORTES",
  "MODIFICAR_OPERACIONES",
  "ANULAR_OPERACIONES",
  "VER_SALDOS",
  "GESTIONAR_ASISTENCIAS",
  "VER_DASHBOARD",
];

const enMayusculas = (columnas) =>
  columnas.map((col) => (col.tipo || col.mayusculas === false ? col : { ...col, mayusculas: true }));

const filtrosAlumna = [
  { key: "estado", etiqueta: "Estado", opciones: ESTADOS_ALUMNA },
  { key: "idciclo", etiqueta: "Ciclo", catalogo: "ciclos" },
  { key: "idturno", etiqueta: "Turno", catalogo: "turnos" },
  { key: "desde", etiqueta: "Desde", tipo: "fecha" },
  { key: "hasta", etiqueta: "Hasta", tipo: "fecha" },
];

const columnasAlumna = [
  { campo: "NOMBRE", etiqueta: "Alumna", ordenable: true, mayusculas: true },
  { campo: "DNI", etiqueta: "DNI" },
  { campo: "CICLO", etiqueta: "Ciclo", mayusculas: true },
  { campo: "TURNO", etiqueta: "Turno" },
  { campo: "CONDICION", etiqueta: "Condición" },
  { campo: "ESTADO", etiqueta: "Estado", tipo: "estado" },
  { campo: "VENCE", etiqueta: "Mensualidad", tipo: "diasRestantes", origen: "FINMENSUALIDAD" },
];

const seccionesAlumna = [
  {
    titulo: "Datos de la alumna",
    campos: [
      { campo: "NOMBRE", etiqueta: "Nombre", control: "text", obligatorio: true },
      { campo: "DNI", etiqueta: "DNI", control: "text" },
      { campo: "FECHANACIMIENTO", etiqueta: "Fecha de nacimiento", control: "date" },
      { campo: "EDAD", etiqueta: "Edad", control: "number", step: "1" },
      { campo: "GENERO", etiqueta: "Género", control: "select", opciones: GENEROS },
      { campo: "EMAIL", etiqueta: "Email", control: "text", validacion: "email" },
      { campo: "TELEFONO", etiqueta: "Teléfono", control: "text" },
      { campo: "COLEGIO", etiqueta: "Colegio", control: "text" },
      { campo: "IDCICLO", etiqueta: "Ciclo", control: "select", catalogo: "ciclos" },
      { campo: "IDTURNO", etiqueta: "Turno", control: "select", catalogo: "turnos", limpia: ["DIASASISTENCIA"] },
      {
        campo: "DIASASISTENCIA",
        etiqueta: "Días que asiste",
        control: "diasTexto",
        catalogo: "turnos",
        diasDe: "IDTURNO",
        full: true,
        ayuda: "Salen los días del turno elegido. Desmarca los que no viene; si va todos, no cambies nada. En Asistencia igual se puede marcar cualquier día (recuperaciones).",
      },
      { campo: "CONDICION", etiqueta: "Condición", control: "select", opciones: CONDICIONES, defaultValue: "Regular" },
      { campo: "TALLA", etiqueta: "Talla", control: "select", opciones: TALLAS },
      { campo: "ESTADO", etiqueta: "Estado", control: "select", opciones: ESTADOS_ALUMNA, obligatorio: true, defaultValue: "Activa" },
      { campo: "MENSUALIDAD", etiqueta: "Mensualidad (S/.)", control: "number" },
      { campo: "FECHAINSCRIPCION", etiqueta: "Fecha de inscripción", control: "date" },
      { campo: "UNIFORMEENTREGADO", etiqueta: "Uniforme entregado", control: "select", opciones: ["NO", "SI"], defaultValue: "NO" },
      { campo: "SUFREDE", etiqueta: "¿Sufre de algo?", control: "text", full: true },
      { campo: "COMOENTERO", etiqueta: "¿Cómo se enteró?", control: "text", full: true },
      { campo: "DIRECCION", etiqueta: "Dirección", control: "textarea", full: true },
    ],
  },
  {
    titulo: "Apoderado",
    campos: [
      { campo: "APODERADO", etiqueta: "Nombre", control: "text" },
      { campo: "DNIAPODERADO", etiqueta: "DNI", control: "text" },
      { campo: "FECHANACAPODERADO", etiqueta: "Fecha de nacimiento", control: "date" },
      { campo: "GENEROAPODERADO", etiqueta: "Género", control: "select", opciones: GENEROS },
      { campo: "TELAPODERADO", etiqueta: "Teléfono", control: "text" },
    ],
  },
  {
    titulo: "Retiro",
    campos: [
      { campo: "FECHARETIRO", etiqueta: "Fecha de retiro", control: "date" },
      { campo: "MOTIVORETIRO", etiqueta: "Motivo", control: "textarea", full: true },
    ],
  },
];

export const alumnaConfig = {
  modulo: "Academia",
  titulo: "Alumnas",
  singular: "alumna",
  femenino: true,
  entidad: "alumnas",
  pk: "IDALUMNA",
  usaCatalogos: true,
  whatsapp: "TELAPODERADO",
  placeholder: "Buscar por nombre, DNI o apoderado...",
  tamanios: [10, 20, 30, 50],
  filtrosIniciales: { estado: "Activa" },
  filtros: filtrosAlumna,
  columnas: columnasAlumna,
  secciones: seccionesAlumna,
  traza: true,
  acciones: ["estadoCuenta"],
  funciones: { nuevo: ["REGISTRAR_ALUMNAS"] },
  despuesDeCrear: {
    titulo: "¿Continuar con la matrícula?",
    mensaje: (alumna) => `${alumna.NOMBRE} quedó registrada. ¿Registrar ahora su matrícula y después el pago?`,
    boton: "Registrar matrícula",
    pagina: "mensualidades",
    funciones: ["REGISTRAR_MATRICULAS", "REGISTRAR_MENSUALIDADES"],
    valores: (id, alumna) => ({
      IDALUMNA: id,
      IDTURNO_ALUMNA: alumna.IDTURNO || "",
      DIASASISTENCIA: alumna.DIASASISTENCIA || "",
      FECHAINICIO: dbToInput(alumna.FECHAINSCRIPCION || ""),
    }),
  },
};

export const retiradasConfig = {
  ...alumnaConfig,
  titulo: "Retiradas",
  permitirNuevo: false,
  filtrosIniciales: { estado: "Retirada" },
  filtros: filtrosAlumna
    .filter((f) => f.key !== "estado")
    .map((f) => (f.tipo === "fecha" ? { ...f, etiqueta: f.key === "desde" ? "Retiro desde" : "Retiro hasta" } : f)),
};

export const cicloConfig = {
  modulo: "Administración",
  titulo: "Ciclos",
  singular: "ciclo",
  entidad: "ciclos",
  pk: "IDCICLO",
  formulario: "modal",
  placeholder: "Buscar ciclo...",
  filtros: [{ key: "estado", etiqueta: "Estado", opciones: ["Activo", "Inactivo"] }],
  columnas: [
    { campo: "NOMBRE", etiqueta: "Ciclo", ordenable: true, mayusculas: true },
    { campo: "ACTIVO", etiqueta: "Estado", tipo: "estado" },
  ],
  campos: [
    { campo: "NOMBRE", etiqueta: "Nombre", control: "text", obligatorio: true, mayusculas: true },
    { campo: "ACTIVO", etiqueta: "Estado", control: "select", opciones: ["Activo", "Inactivo"], defaultValue: "Activo" },
  ],
};

export const turnoConfig = {
  modulo: "Administración",
  titulo: "Turnos",
  entidad: "turnos",
  pk: "IDTURNO",
  placeholder: "Buscar turno...",
  filtros: [{ key: "estado", etiqueta: "Estado", opciones: ["Activo", "Inactivo"] }],
  columnas: enMayusculas([
    { campo: "NOMBRE", etiqueta: "Turno", ordenable: true },
    { campo: "HORARIO", etiqueta: "Horario" },
    { campo: "DIASACTIVOS", etiqueta: "Días" },
    { campo: "ACTIVO", etiqueta: "Estado", tipo: "estado" },
  ]),
  campos: [
    { campo: "NOMBRE", etiqueta: "Nombre", control: "text", obligatorio: true },
    { campo: "HORAINICIO", etiqueta: "Hora de inicio", control: "time", obligatorio: true },
    { campo: "HORAFIN", etiqueta: "Hora de fin", control: "time", obligatorio: true },
    { campo: "DIASACTIVOS", etiqueta: "Días activos", control: "diasTexto", full: true, obligatorio: true },
    { campo: "ACTIVO", etiqueta: "Estado", control: "select", opciones: ["Activo", "Inactivo"], defaultValue: "Activo" },
  ],
};

const PERIODO_ACTIVO = { campo: "PERIODO", valor: "Activo" };

async function cargarDiasAlumna(idAlumna, setValues) {
  try {
    const res = await fetch(`/api/alumnas/${encodeURIComponent(idAlumna)}/`);
    const data = await parseJsonResponse(res);
    const alumna = res.ok ? data.data : null;
    if (!alumna) return;
    setValues((prev) => (prev.IDALUMNA !== idAlumna ? prev : {
      ...prev,
      IDTURNO_ALUMNA: alumna.IDTURNO || "",
      DIASASISTENCIA: alumna.DIASASISTENCIA || "",
    }));
  } catch {
    /* sin turno conocido se muestran los 7 días */
  }
}

export const mensualidadConfig = {
  modulo: "Academia",
  titulo: "Mensualidades",
  singular: "mensualidad",
  femenino: true,
  nuevoEtiqueta: "Nueva matrícula",
  tituloNuevo: "Nueva matrícula",
  entidad: "mensualidades",
  pk: "IDMENSUALIDAD",
  usaCatalogos: true,
  traza: true,
  acciones: ["renovar", "estadoCuenta"],
  funciones: { nuevo: ["REGISTRAR_MENSUALIDADES", "REGISTRAR_MATRICULAS"] },
  placeholder: "Buscar por alumna, DNI o código...",
  filtros: [
    { key: "desde", etiqueta: "Desde", tipo: "fecha" },
    { key: "hasta", etiqueta: "Hasta", tipo: "fecha" },
    { key: "tipo", etiqueta: "Concepto", opciones: ["Matrícula", "Mensualidad"] },
    {
      key: "situacion",
      etiqueta: "Situación",
      opciones: ["Vigente", "Pendiente", "Vencida", "Pagada", "Por iniciar", "Finalizada", "Inactivo"],
    },
    { key: "estado", etiqueta: "Pago", opciones: ["Deuda", "Parcial", "Completada", "Inactivo"] },
    { key: "idciclo", etiqueta: "Ciclo", catalogo: "ciclos" },
    { key: "periodos", etiqueta: "Periodos", vacio: "ÚLTIMO DE CADA ALUMNA", opciones: ["Todos los periodos"] },
  ],
  columnas: [
    {
      campo: "ALUMNA",
      etiqueta: "Alumna",
      mayusculas: true,
      onClick: (row) => abrirEstadoCuenta(row.IDALUMNA, "mensualidades"),
      tituloClick: "Ver todas sus mensualidades",
      detalle: (row) => (Number(row.PERIODOS) > 1 ? `Ver sus ${row.PERIODOS} periodos` : ""),
    },
    { campo: "TIPO", etiqueta: "Concepto" },
    { campo: "CICLO", etiqueta: "Ciclo", mayusculas: true },
    { campo: "FECHAINICIO", etiqueta: "Inicio", tipo: "fecha" },
    { campo: "FECHAFIN", etiqueta: "Fin", tipo: "fecha" },
    { campo: "MONTO", etiqueta: "Monto", tipo: "decimal" },
    { campo: "PAGADO", etiqueta: "Pagado", tipo: "decimal" },
    { campo: "SALDO", etiqueta: "Saldo", tipo: "decimal" },
    { campo: "ESTADO", etiqueta: "Pago", tipo: "estadoPago" },
  ],
  campos: [
    {
      campo: "IDALUMNA",
      etiqueta: "Alumna",
      control: "select",
      remoto: "alumnas",
      obligatorio: true,
      ayuda: "Para las mensualidades siguientes usa el botón Generar el periodo siguiente (↻) de la lista.",
    },
    {
      campo: "DIASASISTENCIA",
      etiqueta: "Días que asistirá",
      control: "diasTexto",
      catalogo: "turnos",
      diasDe: "IDTURNO_ALUMNA",
      soloCrear: true,
      full: true,
      visibleSi: { campo: "IDALUMNA", lleno: true },
      ayuda: "Salen los días de su turno; desmarca los que no vendrá. Se guarda en la ficha de la alumna. En Asistencia igual se puede marcar cualquier día (recuperaciones).",
    },
    {
      campo: "PERIODO",
      etiqueta: "Tipo de periodo",
      control: "select",
      opciones: ["Activo", "Inactivo"],
      defaultValue: "Activo",
      obligatorio: true,
      ayuda: "Inactivo: la alumna no asistió en ese periodo. No genera deuda ni admite pagos.",
    },
    { campo: "FECHAINICIO", etiqueta: "Inicio", control: "date", obligatorio: true },
    { campo: "FECHAFIN", etiqueta: "Fin", control: "date", obligatorio: true },
    {
      campo: "IDPROMOCION",
      etiqueta: "Promoción o tarifa",
      control: "select",
      catalogo: "promociones",
      visibleSi: PERIODO_ACTIVO,
      ayuda: "Opcional. Las promociones se crean en Administración > Promociones. Con promoción, el monto se calcula según el mes de la promoción.",
    },
    {
      campo: "MONTOREGULAR",
      etiqueta: "Tarifa regular (S/.)",
      control: "number",
      visibleSi: PERIODO_ACTIVO,
      ayuda: "Lo que costaría sin promoción. La diferencia con el monto queda como descuento, no como deuda.",
    },
    {
      campo: "MONTO",
      etiqueta: "Monto a cobrar (S/.)",
      control: "number",
      visibleSi: PERIODO_ACTIVO,
      ayuda: "Vacío: se usa el de la promoción o la mensualidad de la alumna.",
    },
    { campo: "NOTAS", etiqueta: "Notas", control: "textarea", full: true },
  ],
  onFieldChange: (campo, valor, setValues, catalogos) => {
    if (campo === "IDALUMNA") {
      setValues((prev) => ({ ...prev, IDTURNO_ALUMNA: "", DIASASISTENCIA: "" }));
      if (valor) cargarDiasAlumna(valor, setValues);
      return;
    }
    if (campo !== "IDPROMOCION") return;
    const promo = (catalogos.promociones || []).find((p) => p.value === valor);
    setValues((prev) => ({
      ...prev,
      MONTOREGULAR: promo ? String(promo.regular) : prev.MONTOREGULAR,
      MONTO: "",
    }));
  },
  despuesDeCrear: {
    titulo: "¿Registrar el pago?",
    mensaje: (_, pago) => `La matrícula quedó registrada${pago.MONTO ? ` por S/ ${Number(pago.MONTO).toFixed(2)}` : ""}. ¿Registrar ahora el pago?`,
    boton: "Registrar pago",
    pagina: "pagos",
    funciones: ["EMITIR_RECIBOS"],
    aplica: (matricula) => matricula.PERIODO !== "Inactivo",
    valores: async (id, matricula) => {
      const res = await fetch(`/api/mensualidades/${encodeURIComponent(id)}/`);
      const data = await parseJsonResponse(res);
      const monto = res.ok ? data.data?.MONTO : null;
      return { IDALUMNA: matricula.IDALUMNA, IDMENSUALIDAD: id, MONTO: monto != null ? String(monto) : "" };
    },
  },
};

export const pagoConfig = {
  modulo: "Academia",
  titulo: "Pagos",
  singular: "pago",
  entidad: "pagos",
  pk: "IDPAGO",
  usaCatalogos: true,
  recibo: "pago",
  traza: true,
  acciones: ["estadoCuenta"],
  funciones: { nuevo: ["EMITIR_RECIBOS"] },
  placeholder: "Buscar por alumna, DNI o N.° de recibo...",
  filtros: [
    { key: "desde", etiqueta: "Desde", tipo: "fecha" },
    { key: "hasta", etiqueta: "Hasta", tipo: "fecha" },
    { key: "estado", etiqueta: "Medio", opciones: MEDIOS },
    { key: "idciclo", etiqueta: "Ciclo", catalogo: "ciclos" },
  ],
  columnas: [
    { campo: "IDPAGO", etiqueta: "Recibo" },
    { campo: "ALUMNA", etiqueta: "Alumna", mayusculas: true },
    { campo: "CICLO", etiqueta: "Ciclo", mayusculas: true },
    { campo: "FECHA", etiqueta: "Fecha", tipo: "fecha" },
    { campo: "PERIODO", etiqueta: "Periodo pagado" },
    { campo: "MONTO", etiqueta: "Monto", tipo: "decimal" },
    { campo: "MEDIO", etiqueta: "Medio" },
    { campo: "ESTADOPERIODO", etiqueta: "Estado del periodo", tipo: "estadoPago" },
    { campo: "REGISTRADOPOR", etiqueta: "Registrado por", tipo: "traza" },
  ],
  campos: [
    { campo: "IDALUMNA", etiqueta: "Alumna", control: "select", remoto: "alumnas", obligatorio: true, limpia: ["IDMENSUALIDAD"] },
    {
      campo: "IDMENSUALIDAD",
      etiqueta: "Periodo que se paga",
      control: "select",
      remoto: "mensualidades",
      filtraPor: "IDALUMNA",
      obligatorio: true,
      ayuda: "Elige el periodo exacto. El pago no se pasa solo a otro periodo ni puede superar su saldo.",
    },
    { campo: "FECHA", etiqueta: "Fecha", control: "date", obligatorio: true, defaultHoy: true },
    { campo: "MONTO", etiqueta: "Monto (S/.)", control: "number", obligatorio: true },
    { campo: "MEDIO", etiqueta: "Medio de pago", control: "select", opciones: MEDIOS, defaultValue: "Efectivo" },
  ],
};

export const promocionConfig = {
  modulo: "Administración",
  titulo: "Promociones",
  singular: "promoción",
  femenino: true,
  entidad: "promociones",
  pk: "IDPROMOCION",
  traza: true,
  funciones: { nuevo: ["MODIFICAR_OPERACIONES"] },
  placeholder: "Buscar promoción...",
  filtros: [{ key: "estado", etiqueta: "Estado", opciones: ["Activo", "Inactivo"] }],
  columnas: enMayusculas([
    { campo: "NOMBRE", etiqueta: "Promoción" },
    { campo: "TIPO", etiqueta: "Aplica a" },
    { campo: "MONTOREGULAR", etiqueta: "Regular", tipo: "decimal" },
    { campo: "MONTOPROMOCIONAL", etiqueta: "Promocional", tipo: "decimal" },
    { campo: "MESESPROMOCION", etiqueta: "Meses" },
    { campo: "MONTOSIGUIENTES", etiqueta: "Siguientes", tipo: "decimal" },
    { campo: "FECHAINICIO", etiqueta: "Desde", tipo: "fecha" },
    { campo: "FECHAFIN", etiqueta: "Hasta", tipo: "fecha" },
    { campo: "USOS", etiqueta: "Usos" },
    { campo: "ACTIVO", etiqueta: "Estado", tipo: "estado" },
  ]),
  secciones: [
    {
      titulo: "Tarifa o promoción",
      campos: [
        { campo: "NOMBRE", etiqueta: "Nombre", control: "text", obligatorio: true },
        {
          campo: "TIPO",
          etiqueta: "Aplica a",
          control: "select",
          opciones: ["General", "Nueva matrícula", "Retorno"],
          defaultValue: "General",
          obligatorio: true,
          ayuda: "Nueva matrícula: solo alumnas sin periodos previos. Retorno: alumnas que vuelven.",
        },
        { campo: "MONTOREGULAR", etiqueta: "Tarifa regular (S/.)", control: "number", obligatorio: true, ayuda: "Ejemplo: 150" },
        { campo: "MONTOPROMOCIONAL", etiqueta: "Monto promocional (S/.)", control: "number", obligatorio: true, ayuda: "Ejemplo: 80 el primer mes" },
        { campo: "MESESPROMOCION", etiqueta: "Número de meses con promoción", control: "number", step: "1", min: "1", defaultValue: "1" },
        { campo: "MONTOSIGUIENTES", etiqueta: "Monto de los meses siguientes (S/.)", control: "number", ayuda: "Ejemplo: 100 desde el segundo mes. Vacío: tarifa regular." },
        { campo: "FECHAINICIO", etiqueta: "Fecha de inicio", control: "date" },
        { campo: "FECHAFIN", etiqueta: "Fecha de término", control: "date" },
        { campo: "ACTIVO", etiqueta: "Estado", control: "select", opciones: ["Activo", "Inactivo"], defaultValue: "Activo" },
        { campo: "CONDICIONES", etiqueta: "Condiciones", control: "textarea", full: true },
      ],
    },
  ],
};

export const ventaConfig = {
  modulo: "Administración",
  titulo: "Ventas",
  entidad: "ventas",
  pk: "IDVENTA",
  usaCatalogos: true,
  recibo: "venta",
  placeholder: "Buscar por N.° de recibo, nombre o producto...",
  columnas: enMayusculas([
    { campo: "NUMERO", etiqueta: "Recibo" },
    { campo: "FECHA", etiqueta: "Fecha", tipo: "fecha" },
    { campo: "NOMBRE", etiqueta: "Nombre", mayusculas: true },
    { campo: "CICLO", etiqueta: "Ciclo", mayusculas: true },
    { campo: "PRODUCTO", etiqueta: "Producto o servicio" },
    { campo: "TALLA", etiqueta: "Talla" },
    { campo: "PRECIO", etiqueta: "Total", tipo: "decimal" },
    { campo: "PAGADO", etiqueta: "Pagado", tipo: "decimal" },
    { campo: "SALDO", etiqueta: "Saldo", tipo: "saldoDeuda" },
    { campo: "MEDIO", etiqueta: "Medio" },
    { campo: "ESTADO_RECIBO", etiqueta: "Estado", tipo: "estado" },
  ]),
  traza: true,
  acciones: ["abonos", "estadoCuenta"],
  funciones: { nuevo: ["REGISTRAR_VENTAS", "EMITIR_BOLETAS"] },
  filtros: [
    { key: "desde", etiqueta: "Desde", tipo: "fecha" },
    { key: "hasta", etiqueta: "Hasta", tipo: "fecha" },
    { key: "estado", etiqueta: "Recibo", vacio: "Estado", opciones: ["Emitido", "Anulado", "Eliminado"] },
    { key: "tipo", etiqueta: "Tipo", opciones: ["Producto físico", "Servicio"] },
    { key: "producto", etiqueta: "Producto o concepto", opciones: [...PRODUCTOS_FISICOS, ...SERVICIOS] },
    { key: "saldo", etiqueta: "Saldo", opciones: ["Con saldo", "Pagado"] },
    { key: "idciclo", etiqueta: "Ciclo", catalogo: "ciclos" },
  ],
  filtrosIniciales: { desde: primerDiaMesInput(), hasta: ultimoDiaMesInput() },
  reporteVentas: true,
  controlRecibos: true,
  campos: [
    { campo: "NOMBRE", etiqueta: "Buscar", control: "buscarNombre", obligatorio: true, placeholder: "Buscar alumno" },
    {
      campo: "TIPO",
      etiqueta: "Tipo",
      control: "select",
      opciones: ["Producto físico", "Servicio"],
      defaultValue: "Producto físico",
      obligatorio: true,
      limpia: ["PRODUCTO", "TALLA", "DETALLE", "PRECIO"],
    },
    {
      campo: "DETALLE",
      etiqueta: "Artículos",
      control: "lineasVenta",
      full: true,
      opciones: PRODUCTOS_FISICOS,
      tallas: TALLAS,
      visibleSi: { campo: "TIPO", valor: "Producto físico" },
    },
    {
      campo: "PRODUCTO",
      etiqueta: "Producto o servicio",
      control: "sugerido",
      dependeDe: "TIPO",
      opcionesPor: {
        "Producto físico": PRODUCTOS_FISICOS,
        Servicio: SERVICIOS,
      },
      obligatorio: true,
      ocultarPlaceholder: true,
      visibleSi: { campo: "TIPO", valor: "Servicio" },
    },
    {
      campo: "NOTA_SERVICIO",
      control: "nota",
      soloFrontend: true,
      full: true,
      visibleSi: { campo: "TIPO", valor: "Servicio" },
      texto: "Se emite como comprobante. Esta venta no crea ni modifica una mensualidad.",
    },
    {
      campo: "COMPROBANTE",
      etiqueta: "Comprobante",
      control: "text",
      bloqueado: true,
      soloFrontend: true,
      soloEditar: true,
      visibleSi: { campo: "TIPO", valor: "Servicio" },
    },
    { campo: "IDTURNO", etiqueta: "Turno", control: "select", catalogo: "turnos", obligatorio: true, ocultarPlaceholder: true },
    { campo: "PRECIO", etiqueta: "Precio (S/.)", control: "number", obligatorio: true, visibleSi: { campo: "TIPO", valor: "Servicio" } },
    { campo: "MEDIO", etiqueta: "Medio de pago", control: "select", opciones: MEDIOS, defaultValue: "Efectivo", ocultarPlaceholder: true },
    {
      campo: "ACUENTA",
      etiqueta: "Pagado a cuenta (S/.)",
      control: "number",
      ayuda: "Vacío: pagado completo. Si paga una parte, la diferencia queda como saldo. Los pagos posteriores se registran con el botón Abonos.",
    },
    { campo: "FECHA", etiqueta: "Fecha", control: "date", defaultHoy: true },
    { campo: "OBSERVACION", etiqueta: "Observación", control: "textarea", full: true },
  ],
};

export const egresoConfig = {
  modulo: "Administración",
  titulo: "Egresos",
  entidad: "egresos",
  pk: "IDEGRESO",
  placeholder: "Buscar por concepto o proveedor...",
  filtros: [
    { key: "desde", etiqueta: "Desde", tipo: "fecha" },
    { key: "hasta", etiqueta: "Hasta", tipo: "fecha" },
    { key: "estado", etiqueta: "Medio", opciones: MEDIOS },
  ],
  columnas: enMayusculas([
    { campo: "FECHA", etiqueta: "Fecha", tipo: "fecha" },
    { campo: "CONCEPTO", etiqueta: "Concepto" },
    { campo: "PROVEEDOR", etiqueta: "Proveedor" },
    { campo: "MONTO", etiqueta: "Monto" },
    { campo: "MEDIO", etiqueta: "Medio" },
  ]),
  campos: [
    { campo: "FECHA", etiqueta: "Fecha", control: "date", obligatorio: true, defaultHoy: true },
    { campo: "CONCEPTO", etiqueta: "Concepto", control: "text", obligatorio: true },
    { campo: "PROVEEDOR", etiqueta: "Proveedor", control: "text" },
    { campo: "MONTO", etiqueta: "Monto (S/.)", control: "number", obligatorio: true },
    { campo: "MEDIO", etiqueta: "Medio de pago", control: "select", opciones: MEDIOS, defaultValue: "Efectivo" },
    { campo: "OBSERVACIONES", etiqueta: "Observaciones", control: "textarea", full: true },
  ],
};

export const usuarioConfig = {
  modulo: "Administración",
  titulo: "Usuarios",
  entidad: "usuarios",
  pk: "IDUSUARIO",
  usaCatalogos: true,
  traza: true,
  funciones: { nuevo: ["GESTIONAR_USUARIOS"], editar: ["GESTIONAR_USUARIOS"], eliminar: ["GESTIONAR_USUARIOS"] },
  placeholder: "Buscar por usuario o nombre...",
  filtros: [{ key: "estado", etiqueta: "Estado", opciones: ["Activo", "Retirado"] }],
  columnas: enMayusculas([
    { campo: "IDUSUARIO", etiqueta: "Usuario", mayusculas: false },
    { campo: "NOMBRE", etiqueta: "Nombre" },
    { campo: "APELLIDO", etiqueta: "Apellido" },
    { campo: "TIPOUSUARIO_DESCRIPCION", etiqueta: "Tipo" },
    { campo: "ESTADO", etiqueta: "Estado", tipo: "estado" },
  ]),
  secciones: [
    {
      titulo: "Acceso",
      campos: [
        { campo: "IDUSUARIO", etiqueta: "Usuario", control: "text", obligatorio: true, soloCrear: true, sinMayusculas: true },
        { campo: "CONTRA", etiqueta: "Contraseña", control: "password", ayuda: "Si la dejas vacía al crear, se usa el usuario." },
        { campo: "IDTIPOUSUARIO", etiqueta: "Tipo", control: "select", catalogo: "tiposUsuario", obligatorio: true, defaultValue: "1" },
        { campo: "ESTADO", etiqueta: "Estado", control: "select", opciones: ["Activo", "Retirado"], defaultValue: "Activo" },
      ],
    },
    {
      titulo: "Datos",
      campos: [
        { campo: "NOMBRE", etiqueta: "Nombres", control: "text", obligatorio: true },
        { campo: "APELLIDO", etiqueta: "Apellidos", control: "text", obligatorio: true },
        { campo: "DNI", etiqueta: "DNI", control: "text" },
        { campo: "EMAIL", etiqueta: "Email", control: "text", validacion: "email" },
      ],
    },
    {
      titulo: "Permisos por función",
      soloTiposUsuario: ["1", "2"],
      campos: [
        {
          campo: "FUNCIONES",
          etiqueta: "Marca lo que este usuario puede hacer",
          control: "checklist",
          catalogo: "funciones",
          full: true,
          defaultValue: FUNCIONES_POR_DEFECTO,
          ayuda: "El administrador siempre tiene todos los permisos.",
        },
      ],
    },
  ],
};

export const auditoriaConfig = {
  modulo: "Administración",
  titulo: "Auditoría",
  entidad: "auditoria",
  pk: "IDAUDITORIA",
  permitirNuevo: false,
  permitirEditar: false,
  permitirEliminar: false,
  detalleAuditoria: true,
  ordenInicial: { campo: "FECHA", direccion: "DESC" },
  placeholder: "Buscar por tabla, usuario, código, campo, módulo, IP o detalle...",
  filtros: [
    { key: "desde", etiqueta: "Desde", tipo: "fecha" },
    { key: "hasta", etiqueta: "Hasta", tipo: "fecha" },
    {
      key: "operacion",
      etiqueta: "Operación",
      opciones: Object.entries(OPERACIONES_AUDITORIA).map(([value, label]) => ({ value, label })),
    },
    { key: "estado", etiqueta: "Tabla", opciones: TABLAS_AUDITORIA },
  ],
  columnas: enMayusculas([
    { campo: "FECHA", etiqueta: "Fecha", tipo: "fecha" },
    { campo: "HORA", etiqueta: "Hora" },
    { campo: "IDUSUARIO", etiqueta: "Usuario", mayusculas: false },
    { campo: "OPERACION", etiqueta: "Operación", tipo: "accionAuditoria" },
    { campo: "TABLA", etiqueta: "Tabla" },
    { campo: "IDREGISTRO", etiqueta: "Registro" },
    { campo: "ACCION", etiqueta: "Acción" },
    { campo: "CAMPOS", etiqueta: "Campos modificados", ordenable: false },
    { campo: "MODULO", etiqueta: "Módulo" },
    { campo: "IP", etiqueta: "IP", mayusculas: false },
    { campo: "DETALLE", etiqueta: "Detalle", ordenable: false },
  ]),
};
