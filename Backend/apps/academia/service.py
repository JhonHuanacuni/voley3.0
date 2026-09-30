"""CRUD de negocio vía stored procedures de VoleyDB."""

from django.db import connection

from core import sp_runner as sp
from core.rows import bandera, entero, jsonable, texto


def _listar(proc, params):
    with connection.cursor() as cursor:
        data, total = sp.call_list(cursor, proc, params)
    return jsonable(data), total


def _uno(proc, id_registro):
    with connection.cursor() as cursor:
        rows = sp.call_simple(cursor, proc, [id_registro])
    return jsonable(rows[0]) if rows else None


def _escribir(proc, params):
    with connection.cursor() as cursor:
        ok, mensaje = sp.call_write(cursor, proc, params)
    return int(ok or 0), mensaje


def _paginacion(params, extras=None):
    valores = [params.get('buscar') or None, params.get('estado') or None]
    if extras:
        valores.extend(extras)
    direccion = 'DESC' if str(params.get('direccion') or '').upper() == 'DESC' else 'ASC'
    valores.extend([
        params.get('ordenarPor') or 'NOMBRE',
        direccion,
        int(params.get('pagina') or 1),
        int(params.get('tamanio') or 10),
    ])
    return valores


def _alumna_valores(payload):
    return [
        texto(payload.get('NOMBRE'), 120),
        entero(payload.get('EDAD')),
        texto(payload.get('DNI'), 15),
        texto(payload.get('EMAIL'), 150),
        texto(payload.get('TELEFONO'), 200),
        texto(payload.get('GENERO'), 20),
        texto(payload.get('IDCICLO'), 50),
        texto(payload.get('CONDICION'), 30),
        texto(payload.get('COLEGIO'), 120),
        texto(payload.get('TALLA'), 5),
        texto(payload.get('SUFREDE'), 255),
        texto(payload.get('COMOENTERO'), 200),
        bandera(payload.get('UNIFORMEENTREGADO')),
        texto(payload.get('APODERADO'), 120),
        texto(payload.get('DNIAPODERADO'), 15),
        texto(payload.get('FECHANACAPODERADO'), 8),
        texto(payload.get('GENEROAPODERADO'), 20),
        texto(payload.get('TELAPODERADO'), 200),
        texto(payload.get('DIRECCION'), 500),
        texto(payload.get('IDTURNO'), 50),
        texto(payload.get('ESTADO'), 20),
        texto(payload.get('MOTIVORETIRO'), 500),
        texto(payload.get('FECHARETIRO'), 8),
        texto(payload.get('MENSUALIDAD')),
        texto(payload.get('FECHAINSCRIPCION'), 8),
        texto(payload.get('INICIOMENSUALIDAD'), 8),
        texto(payload.get('FINMENSUALIDAD'), 8),
        texto(payload.get('FECHANACIMIENTO'), 8),
    ]


def listar_alumnas(params):
    consulta = dict(params)
    try:
        tamanio = int(consulta.get('tamanio') or 10)
    except (TypeError, ValueError):
        tamanio = 10
    consulta['tamanio'] = tamanio if tamanio in (10, 20, 30, 50) else 10
    extras = [consulta.get('idciclo') or None, consulta.get('idturno') or None]
    return _listar('usp_alumna_listar', _paginacion(consulta, extras))


def obtener_alumna(id_registro):
    return _uno('usp_alumna_obtener', id_registro)


def insertar_alumna(payload):
    return _escribir('usp_alumna_insertar', _alumna_valores(payload))


def actualizar_alumna(id_registro, payload):
    return _escribir('usp_alumna_actualizar', [id_registro, *_alumna_valores(payload)])


def eliminar_alumna(id_registro):
    return _escribir('usp_alumna_eliminar', [id_registro])


def listar_ciclos(params):
    return _listar('usp_ciclo_listar', _paginacion(params))


def obtener_ciclo(id_registro):
    return _uno('usp_ciclo_obtener', id_registro)


def insertar_ciclo(payload):
    return _escribir('usp_ciclo_insertar', [texto(payload.get('NOMBRE'), 120), texto(payload.get('ACTIVO'), 20)])


def actualizar_ciclo(id_registro, payload):
    return _escribir('usp_ciclo_actualizar', [id_registro, texto(payload.get('NOMBRE'), 120), texto(payload.get('ACTIVO'), 20)])


def eliminar_ciclo(id_registro):
    return _escribir('usp_ciclo_eliminar', [id_registro])


def listar_turnos(params):
    return _listar('usp_turno_listar', _paginacion(params))


def obtener_turno(id_registro):
    return _uno('usp_turno_obtener', id_registro)


def _turno_valores(payload):
    return [
        texto(payload.get('NOMBRE'), 120),
        texto(payload.get('HORAINICIO'), 5),
        texto(payload.get('HORAFIN'), 5),
        texto(payload.get('DIASACTIVOS'), 120),
        texto(payload.get('ACTIVO'), 20),
    ]


def insertar_turno(payload):
    return _escribir('usp_turno_insertar', _turno_valores(payload))


def actualizar_turno(id_registro, payload):
    return _escribir('usp_turno_actualizar', [id_registro, *_turno_valores(payload)])


def eliminar_turno(id_registro):
    return _escribir('usp_turno_eliminar', [id_registro])


def listar_usuarios(params):
    return _listar('usp_usuario_listar', _paginacion(params))


def obtener_usuario(id_registro):
    return _uno('usp_usuario_obtener', id_registro)


def _usuario_valores(payload, incluir_id=False):
    valores = []
    if incluir_id:
        valores.append(texto(payload.get('IDUSUARIO'), 50))
    valores.extend([
        texto(payload.get('CONTRA'), 255),
        texto(payload.get('NOMBRE'), 100),
        texto(payload.get('APELLIDO'), 100),
        texto(payload.get('DNI'), 20),
        texto(payload.get('EMAIL'), 150),
        texto(payload.get('IDTIPOUSUARIO'), 50),
        texto(payload.get('ESTADO'), 50) or 'Activo',
    ])
    return valores


def insertar_usuario(payload):
    return _escribir('usp_usuario_insertar', _usuario_valores(payload, incluir_id=True))


def actualizar_usuario(id_registro, payload):
    return _escribir('usp_usuario_actualizar', [id_registro, *_usuario_valores(payload)])


def eliminar_usuario(id_registro):
    return _escribir('usp_usuario_eliminar', [id_registro])


def listar_mensualidades(params):
    return _listar('usp_mensualidad_listar', _paginacion(params))


def obtener_mensualidad(id_registro):
    return _uno('usp_mensualidad_obtener', id_registro)


def _mensualidad_valores(payload):
    return [
        texto(payload.get('IDALUMNA'), 50),
        texto(payload.get('FECHAINICIO'), 8),
        texto(payload.get('FECHAFIN'), 8),
        texto(payload.get('MONTO')),
        texto(payload.get('NOTAS'), 500),
    ]


def insertar_mensualidad(payload):
    return _escribir('usp_mensualidad_insertar', _mensualidad_valores(payload))


def actualizar_mensualidad(id_registro, payload):
    return _escribir('usp_mensualidad_actualizar', [id_registro, *_mensualidad_valores(payload)])


def eliminar_mensualidad(id_registro):
    return _escribir('usp_mensualidad_eliminar', [id_registro])


def listar_pagos(params):
    return _listar('usp_pago_listar', _paginacion(params))


def obtener_pago(id_registro):
    return _uno('usp_pago_obtener', id_registro)


def _pago_valores(payload):
    return [
        texto(payload.get('IDALUMNA'), 50),
        texto(payload.get('IDMENSUALIDAD'), 50),
        texto(payload.get('FECHA'), 8),
        texto(payload.get('MONTO')),
        texto(payload.get('MEDIO'), 30),
    ]


def insertar_pago(payload):
    return _escribir('usp_pago_insertar', _pago_valores(payload))


def actualizar_pago(id_registro, payload):
    return _escribir('usp_pago_actualizar', [id_registro, *_pago_valores(payload)])


def eliminar_pago(id_registro):
    return _escribir('usp_pago_eliminar', [id_registro])


def listar_ventas(params):
    return _listar('usp_venta_listar', _paginacion(params))


def obtener_venta(id_registro):
    return _uno('usp_venta_obtener', id_registro)


def _venta_valores(payload):
    return [
        texto(payload.get('NOMBRE'), 200),
        texto(payload.get('PRODUCTO'), 60),
        texto(payload.get('IDTURNO'), 50),
        texto(payload.get('TALLA'), 5),
        texto(payload.get('OBSERVACION'), 500),
        texto(payload.get('PRECIO')),
        texto(payload.get('MEDIO'), 30),
        texto(payload.get('FECHA'), 8),
    ]


def insertar_venta(payload):
    return _escribir('usp_venta_insertar', _venta_valores(payload))


def actualizar_venta(id_registro, payload):
    return _escribir('usp_venta_actualizar', [id_registro, *_venta_valores(payload)])


def eliminar_venta(id_registro):
    return _escribir('usp_venta_eliminar', [id_registro])


def listar_egresos(params):
    return _listar('usp_egreso_listar', _paginacion(params))


def obtener_egreso(id_registro):
    return _uno('usp_egreso_obtener', id_registro)


def _egreso_valores(payload):
    return [
        texto(payload.get('FECHA'), 8),
        texto(payload.get('CONCEPTO'), 200),
        texto(payload.get('PROVEEDOR'), 200),
        texto(payload.get('MONTO')),
        texto(payload.get('MEDIO'), 30),
        texto(payload.get('OBSERVACIONES'), 500),
    ]


def insertar_egreso(payload):
    return _escribir('usp_egreso_insertar', _egreso_valores(payload))


def actualizar_egreso(id_registro, payload):
    return _escribir('usp_egreso_actualizar', [id_registro, *_egreso_valores(payload)])


def eliminar_egreso(id_registro):
    return _escribir('usp_egreso_eliminar', [id_registro])


def listar_auditoria(params):
    return _listar('usp_auditoria_listar', _paginacion(params))


def asistencia_dia(fecha, id_turno):
    with connection.cursor() as cursor:
        rows = sp.call_simple(cursor, 'usp_asistencia_dia', [fecha, id_turno or None])
    return jsonable(rows)


def marcar_asistencia(payload):
    return _escribir('usp_asistencia_marcar', [
        texto(payload.get('IDALUMNA'), 50),
        texto(payload.get('FECHA'), 8),
        texto(payload.get('ESTADO'), 20),
    ])


def dashboard():
    with connection.cursor() as cursor:
        resumen = sp.call_simple(cursor, 'usp_dashboard_resumen', [])
        turnos = sp.call_simple(cursor, 'usp_dashboard_turnos', [])
    return {
        'resumen': jsonable(resumen[0] if resumen else {}),
        'turnos': jsonable(turnos),
    }


def catalogos():
    with connection.cursor() as cursor:
        cursor.execute("SELECT IDCICLO, NOMBRE FROM CICLO WHERE ACTIVO = 1 ORDER BY NOMBRE")
        ciclos = [{'value': a, 'label': b} for a, b in cursor.fetchall()]
        cursor.execute(
            "SELECT IDTURNO, NOMBRE, HORAINICIO, HORAFIN FROM TURNO WHERE ACTIVO = 1 ORDER BY HORAINICIO, NOMBRE"
        )
        turnos = [
            {'value': a, 'label': f'{b} ({c} - {d})'}
            for a, b, c, d in cursor.fetchall()
        ]
        cursor.execute("SELECT IDALUMNA, NOMBRE FROM ALUMNA WHERE ESTADO <> 'Retirada' ORDER BY NOMBRE")
        alumnas = [{'value': a, 'label': b} for a, b in cursor.fetchall()]
        cursor.execute(
            """
            SELECT m.IDMENSUALIDAD, a.IDALUMNA, a.NOMBRE, m.FECHAINICIO, m.FECHAFIN
            FROM MENSUALIDAD m
            INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
            ORDER BY m.FECHAFIN DESC
            """
        )
        mensualidades = [
            {'value': a, 'idalumna': b, 'nombre': c, 'inicio': d, 'fin': e}
            for a, b, c, d, e in cursor.fetchall()
        ]
        cursor.execute("SELECT IDTIPOUSUARIO, DESCRIPCION FROM TIPOUSUARIO ORDER BY IDTIPOUSUARIO")
        tipos = [{'value': a, 'label': b} for a, b in cursor.fetchall()]
    return {
        'ciclos': ciclos,
        'turnos': turnos,
        'alumnas': alumnas,
        'mensualidades': mensualidades,
        'tiposUsuario': tipos,
    }


OPERACIONES = {
    'alumnas': (listar_alumnas, obtener_alumna, insertar_alumna, actualizar_alumna, eliminar_alumna),
    'ciclos': (listar_ciclos, obtener_ciclo, insertar_ciclo, actualizar_ciclo, eliminar_ciclo),
    'turnos': (listar_turnos, obtener_turno, insertar_turno, actualizar_turno, eliminar_turno),
    'usuarios': (listar_usuarios, obtener_usuario, insertar_usuario, actualizar_usuario, eliminar_usuario),
    'mensualidades': (listar_mensualidades, obtener_mensualidad, insertar_mensualidad, actualizar_mensualidad, eliminar_mensualidad),
    'pagos': (listar_pagos, obtener_pago, insertar_pago, actualizar_pago, eliminar_pago),
    'ventas': (listar_ventas, obtener_venta, insertar_venta, actualizar_venta, eliminar_venta),
    'egresos': (listar_egresos, obtener_egreso, insertar_egreso, actualizar_egreso, eliminar_egreso),
    'auditoria': (listar_auditoria, None, None, None, None),
}
