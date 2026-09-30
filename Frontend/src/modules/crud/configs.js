const MEDIOS = ["Efectivo", "Transferencia", "Tarjeta", "Yape", "Plin", "Otro"];
const GENEROS = ["Mujer", "Hombre"];
const CONDICIONES = ["Regular", "Becado", "1/2 beca"];
const TALLAS = ["XS", "S", "M", "L"];
const PRODUCTOS = ["Camiseta deportiva", "Falda short", "Short", "Medias", "Rodilleras", "Mangas", "Poleras"];
const ESTADOS_ALUMNA = ["Activa", "Inactiva", "Retirada"];

const filtrosAlumna = [
  { key: "estado", etiqueta: "Estado", opciones: ESTADOS_ALUMNA },
  { key: "idciclo", etiqueta: "Ciclo", catalogo: "ciclos" },
  { key: "idturno", etiqueta: "Turno", catalogo: "turnos" },
];

const columnasAlumna = [
  { campo: "NOMBRE", etiqueta: "Alumna", ordenable: true },
  { campo: "DNI", etiqueta: "DNI" },
  { campo: "CICLO", etiqueta: "Ciclo" },
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
      { campo: "IDTURNO", etiqueta: "Turno", control: "select", catalogo: "turnos" },
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
};

export const retiradasConfig = {
  ...alumnaConfig,
  titulo: "Retiradas",
  permitirNuevo: false,
  filtrosIniciales: { estado: "Retirada" },
  filtros: filtrosAlumna.filter((f) => f.key !== "estado"),
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
  columnas: [
    { campo: "NOMBRE", etiqueta: "Turno", ordenable: true },
    { campo: "HORARIO", etiqueta: "Horario" },
    { campo: "DIASACTIVOS", etiqueta: "Días" },
    { campo: "ACTIVO", etiqueta: "Estado", tipo: "estado" },
  ],
  campos: [
    { campo: "NOMBRE", etiqueta: "Nombre", control: "text", obligatorio: true },
    { campo: "HORAINICIO", etiqueta: "Hora de inicio", control: "time", obligatorio: true },
    { campo: "HORAFIN", etiqueta: "Hora de fin", control: "time", obligatorio: true },
    { campo: "DIASACTIVOS", etiqueta: "Días activos", control: "text", ayuda: "Ejemplo: Lunes, Miércoles, Viernes. Vacío = todos." },
    { campo: "ACTIVO", etiqueta: "Estado", control: "select", opciones: ["Activo", "Inactivo"], defaultValue: "Activo" },
  ],
};

export const mensualidadConfig = {
  modulo: "Academia",
  titulo: "Mensualidades",
  entidad: "mensualidades",
  pk: "IDMENSUALIDAD",
  usaCatalogos: true,
  placeholder: "Buscar por alumna...",
  filtros: [{ key: "estado", etiqueta: "Estado", opciones: ["Deuda", "Completada"] }],
  columnas: [
    { campo: "ALUMNA", etiqueta: "Alumna" },
    { campo: "FECHAINICIO", etiqueta: "Inicio", tipo: "fecha" },
    { campo: "FECHAFIN", etiqueta: "Fin", tipo: "fecha" },
    { campo: "MONTO", etiqueta: "Monto" },
    { campo: "SALDO", etiqueta: "Saldo" },
    { campo: "ESTADO", etiqueta: "Estado", tipo: "estado" },
    { campo: "VENCE", etiqueta: "Restante", tipo: "diasRestantes", origen: "FECHAFIN" },
  ],
  campos: [
    { campo: "IDALUMNA", etiqueta: "Alumna", control: "select", catalogo: "alumnas", obligatorio: true, buscar: true },
    { campo: "FECHAINICIO", etiqueta: "Inicio", control: "date", obligatorio: true },
    { campo: "FECHAFIN", etiqueta: "Fin", control: "date", obligatorio: true },
    { campo: "MONTO", etiqueta: "Monto (S/.)", control: "number", obligatorio: true },
    { campo: "NOTAS", etiqueta: "Notas", control: "textarea", full: true },
  ],
};

export const pagoConfig = {
  modulo: "Academia",
  titulo: "Pagos",
  entidad: "pagos",
  pk: "IDPAGO",
  usaCatalogos: true,
  placeholder: "Buscar por alumna o medio...",
  columnas: [
    { campo: "ALUMNA", etiqueta: "Alumna" },
    { campo: "FECHA", etiqueta: "Fecha", tipo: "fecha" },
    { campo: "MONTO", etiqueta: "Monto" },
    { campo: "MEDIO", etiqueta: "Medio" },
  ],
  campos: [
    { campo: "IDALUMNA", etiqueta: "Alumna", control: "select", catalogo: "alumnas", obligatorio: true, buscar: true, limpia: ["IDMENSUALIDAD"] },
    { campo: "IDMENSUALIDAD", etiqueta: "Mensualidad", control: "select", catalogo: "mensualidades", filtraPor: "IDALUMNA" },
    { campo: "FECHA", etiqueta: "Fecha", control: "date", obligatorio: true, defaultHoy: true },
    { campo: "MONTO", etiqueta: "Monto (S/.)", control: "number", obligatorio: true },
    { campo: "MEDIO", etiqueta: "Medio de pago", control: "select", opciones: MEDIOS, defaultValue: "Efectivo" },
  ],
};

export const ventaConfig = {
  modulo: "Administración",
  titulo: "Ventas",
  entidad: "ventas",
  pk: "IDVENTA",
  usaCatalogos: true,
  placeholder: "Buscar por nombre o producto...",
  columnas: [
    { campo: "FECHA", etiqueta: "Fecha", tipo: "fecha" },
    { campo: "NOMBRE", etiqueta: "Nombre" },
    { campo: "PRODUCTO", etiqueta: "Producto" },
    { campo: "TURNO", etiqueta: "Turno" },
    { campo: "TALLA", etiqueta: "Talla" },
    { campo: "PRECIO", etiqueta: "Precio" },
    { campo: "MEDIO", etiqueta: "Medio" },
  ],
  campos: [
    { campo: "NOMBRE", etiqueta: "Nombre", control: "text", obligatorio: true },
    { campo: "PRODUCTO", etiqueta: "Producto", control: "select", opciones: PRODUCTOS },
    { campo: "IDTURNO", etiqueta: "Turno", control: "select", catalogo: "turnos", obligatorio: true },
    { campo: "TALLA", etiqueta: "Talla", control: "select", opciones: TALLAS },
    { campo: "PRECIO", etiqueta: "Precio (S/.)", control: "number", obligatorio: true },
    { campo: "MEDIO", etiqueta: "Medio de pago", control: "select", opciones: MEDIOS, defaultValue: "Efectivo" },
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
  columnas: [
    { campo: "FECHA", etiqueta: "Fecha", tipo: "fecha" },
    { campo: "CONCEPTO", etiqueta: "Concepto" },
    { campo: "PROVEEDOR", etiqueta: "Proveedor" },
    { campo: "MONTO", etiqueta: "Monto" },
    { campo: "MEDIO", etiqueta: "Medio" },
  ],
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
  placeholder: "Buscar por usuario o nombre...",
  filtros: [{ key: "estado", etiqueta: "Estado", opciones: ["Activo", "Retirado"] }],
  columnas: [
    { campo: "IDUSUARIO", etiqueta: "Usuario" },
    { campo: "NOMBRE", etiqueta: "Nombre" },
    { campo: "APELLIDO", etiqueta: "Apellido" },
    { campo: "TIPOUSUARIO_DESCRIPCION", etiqueta: "Tipo" },
    { campo: "ESTADO", etiqueta: "Estado", tipo: "estado" },
  ],
  secciones: [
    {
      titulo: "Acceso",
      campos: [
        { campo: "IDUSUARIO", etiqueta: "Usuario", control: "text", obligatorio: true, soloCrear: true },
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
  ],
};

export const auditoriaConfig = {
  modulo: "Administración",
  titulo: "Auditoría",
  entidad: "auditoria",
  pk: "IDAUDITORIA",
  permitirNuevo: false,
  permitirVer: false,
  permitirEditar: false,
  permitirEliminar: false,
  placeholder: "Buscar por tabla, usuario o detalle...",
  columnas: [
    { campo: "FECHA", etiqueta: "Fecha", tipo: "fecha" },
    { campo: "HORA", etiqueta: "Hora" },
    { campo: "IDUSUARIO", etiqueta: "Usuario" },
    { campo: "TABLA", etiqueta: "Tabla" },
    { campo: "ACCION", etiqueta: "Acción" },
    { campo: "DETALLE", etiqueta: "Detalle" },
  ],
};
