"""Permisos por función, configurables por usuario (tabla USUARIO_FUNCION)."""

from django.db import connection

FUNCIONES = [
    ('REGISTRAR_ALUMNAS', 'Registrar alumnas'),
    ('REGISTRAR_MATRICULAS', 'Registrar matrículas'),
    ('REGISTRAR_MENSUALIDADES', 'Registrar mensualidades'),
    ('REGISTRAR_VENTAS', 'Registrar ventas'),
    ('EMITIR_RECIBOS', 'Emitir recibos'),
    ('EMITIR_BOLETAS', 'Emitir boletas o notas de venta'),
    ('VER_REPORTES', 'Ver reportes'),
    ('MODIFICAR_OPERACIONES', 'Modificar operaciones'),
    ('ANULAR_OPERACIONES', 'Anular operaciones'),
    ('VER_SALDOS', 'Ver saldos pendientes'),
    ('GESTIONAR_ASISTENCIAS', 'Gestionar asistencias'),
    ('VER_DASHBOARD', 'Ver dashboard'),
    ('GESTIONAR_USUARIOS', 'Gestionar usuarios'),
]

CODIGOS = [codigo for codigo, _ in FUNCIONES]

# Sin configuración propia, el usuario puede todo menos gestionar usuarios.
POR_DEFECTO = [c for c in CODIGOS if c != 'GESTIONAR_USUARIOS']

# Una página del menú se muestra si el usuario tiene al menos una de estas funciones.
PAGINA_FUNCIONES = {
    'dashboard': ['VER_DASHBOARD'],
    'asistencia': ['GESTIONAR_ASISTENCIAS'],
    'mensualidades': ['REGISTRAR_MENSUALIDADES', 'REGISTRAR_MATRICULAS', 'VER_SALDOS', 'MODIFICAR_OPERACIONES'],
    'pagos': ['EMITIR_RECIBOS', 'VER_SALDOS', 'MODIFICAR_OPERACIONES'],
    'ventas': ['REGISTRAR_VENTAS', 'EMITIR_BOLETAS', 'MODIFICAR_OPERACIONES'],
    'deudas': ['VER_SALDOS'],
    'reportes': ['VER_REPORTES'],
    'usuarios': ['GESTIONAR_USUARIOS'],
    'promociones': ['REGISTRAR_MENSUALIDADES', 'MODIFICAR_OPERACIONES'],
}


def _tipo_usuario(idusuario):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT IDTIPOUSUARIO FROM USUARIO WHERE IDUSUARIO = %s AND ESTADO = 'Activo'",
            [idusuario],
        )
        row = cursor.fetchone()
    return str(row[0]) if row else None


def funciones_guardadas(idusuario):
    """Códigos guardados para el usuario; None si nunca se configuró."""
    with connection.cursor() as cursor:
        cursor.execute('SELECT CODIGO FROM USUARIO_FUNCION WHERE IDUSUARIO = %s', [idusuario])
        filas = [r[0] for r in cursor.fetchall()]
    if not filas:
        return None
    return [c for c in filas if c in CODIGOS]


def funciones_usuario(idusuario):
    if not idusuario:
        return []
    tipo = _tipo_usuario(idusuario)
    if not tipo:
        return []
    if tipo == '3':
        return list(CODIGOS)
    guardadas = funciones_guardadas(idusuario)
    return list(POR_DEFECTO) if guardadas is None else guardadas


def puede(idusuario, *codigos):
    if not codigos:
        return True
    propias = set(funciones_usuario(idusuario))
    return any(c in propias for c in codigos)


def pagina_visible(page, funciones):
    requeridas = PAGINA_FUNCIONES.get(page)
    if not requeridas:
        return True
    return any(c in funciones for c in requeridas)
