"""CRUD de negocio vía stored procedures de VoleyDB."""

import calendar
import json
import unicodedata
from datetime import date

from django.db import connection

from apps.permisos import CODIGOS, FUNCIONES, POR_DEFECTO, funciones_guardadas
from core import sp_runner as sp
from core.rows import bandera, entero, jsonable, texto


def _listar(proc, params):
    with connection.cursor() as cursor:
        data, total = sp.call_list(cursor, proc, params)
    return jsonable(data), total


_CAMPOS_FECHA = ('FINMENSUALIDAD', 'INICIOMENSUALIDAD')


def _clave_orden(campo):
    es_fecha = campo.startswith('FECHA') or campo in _CAMPOS_FECHA

    def clave(fila):
        valor = fila.get(campo)
        if valor is None or valor == '':
            return (1, 0, '')
        if isinstance(valor, (int, float)):
            return (0, valor, '')
        texto_valor = str(valor).strip()
        if es_fecha and len(texto_valor) == 8 and texto_valor.isdigit():
            return (0, int(texto_valor[4:] + texto_valor[2:4] + texto_valor[:2]), '')
        normal = unicodedata.normalize('NFKD', texto_valor.casefold())
        return (0, 0, ''.join(c for c in normal if not unicodedata.combining(c)))

    return clave


def listar_ordenado(listar, params):
    """Ordena por cualquier columna sobre todos los registros filtrados y luego pagina."""
    campo = str(params.get('ordenarPor') or '').strip().upper()
    if not campo or listar in ORDENAN_EN_SP:
        return listar(params)
    pagina = max(int(params.get('pagina') or 1), 1)
    tamanio = max(int(params.get('tamanio') or 10), 1)
    data, total = listar({**params, 'pagina': 1, 'tamanio': 100000})
    clave = _clave_orden(campo)
    vacios = [f for f in data if clave(f)[0] == 1]
    llenos = sorted((f for f in data if clave(f)[0] == 0), key=clave,
                    reverse=str(params.get('direccion') or '').upper() == 'DESC')
    ordenados = llenos + vacios
    inicio = (pagina - 1) * tamanio
    return ordenados[inicio:inicio + tamanio], total


def _uno(proc, id_registro):
    with connection.cursor() as cursor:
        rows = sp.call_simple(cursor, proc, [id_registro])
    return jsonable(rows[0]) if rows else None


def _escribir(proc, params):
    with connection.cursor() as cursor:
        ok, mensaje = sp.call_write(cursor, proc, params)
    return int(ok or 0), mensaje


def _escribir_con_id(proc, params):
    with connection.cursor() as cursor:
        ok, mensaje, nuevo_id = sp.call_write_outs(cursor, proc, params, ['@_sp_r', '@_sp_m', '@_sp_id'])
    return int(ok or 0), str(mensaje or ''), nuevo_id


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


def _rango(params):
    return [_fecha_param(params.get('desde')), _fecha_param(params.get('hasta'))]


def _alumna_valores(payload):
    return [
        texto(payload.get('NOMBRE'), 120),
        entero(payload.get('EDAD')),
        texto(payload.get('DNI'), 15),
        texto(payload.get('EMAIL'), 150),
        texto(payload.get('TELEFONO'), 200),
        texto(payload.get('GENERO'), 20, mayusculas=False),
        texto(payload.get('IDCICLO'), 50),
        texto(payload.get('CONDICION'), 30, mayusculas=False),
        texto(payload.get('COLEGIO'), 120),
        texto(payload.get('TALLA'), 5),
        texto(payload.get('SUFREDE'), 255),
        texto(payload.get('COMOENTERO'), 200),
        bandera(payload.get('UNIFORMEENTREGADO')),
        texto(payload.get('APODERADO'), 120),
        texto(payload.get('DNIAPODERADO'), 15),
        texto(payload.get('FECHANACAPODERADO'), 8),
        texto(payload.get('GENEROAPODERADO'), 20, mayusculas=False),
        texto(payload.get('TELAPODERADO'), 200),
        texto(payload.get('DIRECCION'), 500),
        texto(payload.get('IDTURNO'), 50),
        texto(payload.get('ESTADO'), 20, mayusculas=False),
        texto(payload.get('MOTIVORETIRO'), 500),
        texto(payload.get('FECHARETIRO'), 8),
        texto(payload.get('MENSUALIDAD')),
        texto(payload.get('FECHAINSCRIPCION'), 8),
        texto(payload.get('INICIOMENSUALIDAD'), 8),
        texto(payload.get('FINMENSUALIDAD'), 8),
        texto(payload.get('FECHANACIMIENTO'), 8),
        texto(payload.get('DIASASISTENCIA'), 120),
    ]


def listar_alumnas(params):
    consulta = dict(params)
    try:
        tamanio = int(consulta.get('tamanio') or 10)
    except (TypeError, ValueError):
        tamanio = 10
    consulta['tamanio'] = tamanio if tamanio > 0 else 10
    extras = [consulta.get('idciclo') or None, consulta.get('idturno') or None, *_rango(consulta)]
    return _listar('usp_alumna_listar', _paginacion(consulta, extras))


def obtener_alumna(id_registro):
    return _uno('usp_alumna_obtener', id_registro)


def insertar_alumna(payload):
    return _escribir_con_id('usp_alumna_insertar', _alumna_valores(payload))


def actualizar_alumna(id_registro, payload):
    return _escribir('usp_alumna_actualizar', [id_registro, *_alumna_valores(payload)])


def eliminar_alumna(id_registro):
    return _escribir('usp_alumna_eliminar', [id_registro])


def reactivar_alumna(id_registro):
    return _escribir('usp_alumna_reactivar', [id_registro])


def listar_ciclos(params):
    return _listar('usp_ciclo_listar', _paginacion(params))


def obtener_ciclo(id_registro):
    return _uno('usp_ciclo_obtener', id_registro)


def insertar_ciclo(payload):
    return _escribir('usp_ciclo_insertar', [texto(payload.get('NOMBRE'), 120), texto(payload.get('ACTIVO'), 20, mayusculas=False)])


def actualizar_ciclo(id_registro, payload):
    return _escribir('usp_ciclo_actualizar', [id_registro, texto(payload.get('NOMBRE'), 120), texto(payload.get('ACTIVO'), 20, mayusculas=False)])


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
        texto(payload.get('ACTIVO'), 20, mayusculas=False),
    ]


SIN_DIAS_TURNO = (0, 'Marca al menos un día.')


def insertar_turno(payload):
    valores = _turno_valores(payload)
    if not valores[3]:
        return SIN_DIAS_TURNO
    return _escribir('usp_turno_insertar', valores)


def actualizar_turno(id_registro, payload):
    valores = _turno_valores(payload)
    if not valores[3]:
        return SIN_DIAS_TURNO
    return _escribir('usp_turno_actualizar', [id_registro, *valores])


def eliminar_turno(id_registro):
    return _escribir('usp_turno_eliminar', [id_registro])


def listar_usuarios(params):
    return _listar('usp_usuario_listar', _paginacion(params))


def obtener_usuario(id_registro):
    fila = _uno('usp_usuario_obtener', id_registro)
    if fila:
        guardadas = funciones_guardadas(id_registro)
        fila['FUNCIONES'] = list(POR_DEFECTO) if guardadas is None else guardadas
    return fila


def _guardar_funciones(id_usuario, payload, resultado):
    ok, mensaje = resultado
    if not ok or 'FUNCIONES' not in payload:
        return resultado
    codigos = payload.get('FUNCIONES') or []
    if isinstance(codigos, str):
        codigos = [c for c in codigos.split(',') if c]
    validos = ','.join(c for c in codigos if c in CODIGOS)
    ok_f, mensaje_f = _escribir('usp_usuario_funciones_guardar', [id_usuario, validos])
    if not ok_f:
        return 1, f'{mensaje} Pero no se guardaron los permisos: {mensaje_f}'
    return ok, mensaje


def _usuario_valores(payload, incluir_id=False):
    valores = []
    if incluir_id:
        valores.append(texto(payload.get('IDUSUARIO'), 50, mayusculas=False))
    valores.extend([
        texto(payload.get('CONTRA'), 255, mayusculas=False),
        texto(payload.get('NOMBRE'), 100),
        texto(payload.get('APELLIDO'), 100),
        texto(payload.get('DNI'), 20),
        texto(payload.get('EMAIL'), 150),
        texto(payload.get('IDTIPOUSUARIO'), 50),
        texto(payload.get('ESTADO'), 50, mayusculas=False) or 'Activo',
    ])
    return valores


def insertar_usuario(payload):
    valores = _usuario_valores(payload, incluir_id=True)
    return _guardar_funciones(valores[0], payload, _escribir('usp_usuario_insertar', valores))


def actualizar_usuario(id_registro, payload):
    resultado = _escribir('usp_usuario_actualizar', [id_registro, *_usuario_valores(payload)])
    return _guardar_funciones(id_registro, payload, resultado)


def eliminar_usuario(id_registro):
    return _escribir('usp_usuario_eliminar', [id_registro])


PERIODOS_TODOS = 'Todos los periodos'


def listar_mensualidades(params):
    return _listar('usp_mensualidad_listar', _paginacion(params, extras=[
        *_rango(params),
        params.get('idciclo') or None,
        params.get('situacion') or None,
        params.get('tipo') or None,
        1 if params.get('periodos') == PERIODOS_TODOS else 0,
    ]))


def obtener_mensualidad(id_registro):
    return _uno('usp_mensualidad_obtener', id_registro)


def _mensualidad_valores(payload):
    return [
        texto(payload.get('IDALUMNA'), 50),
        texto(payload.get('FECHAINICIO'), 8),
        texto(payload.get('FECHAFIN'), 8),
        texto(payload.get('MONTO')),
        texto(payload.get('MONTOREGULAR')),
        texto(payload.get('IDPROMOCION'), 50),
        texto(payload.get('PERIODO'), 20, mayusculas=False) or 'Activo',
        texto(payload.get('NOTAS'), 500),
    ]


def es_primera_mensualidad(id_alumna):
    with connection.cursor() as cursor:
        cursor.execute('SELECT COUNT(*) FROM MENSUALIDAD WHERE IDALUMNA = %s', [id_alumna])
        return int(cursor.fetchone()[0] or 0) == 0


def renovar_mensualidad(id_registro):
    return _escribir('usp_mensualidad_renovar', [id_registro])


def insertar_mensualidad(payload):
    ok, mensaje, nuevo_id = _escribir_con_id('usp_mensualidad_insertar', _mensualidad_valores(payload))
    if ok and 'DIASASISTENCIA' in payload:
        ok_dias, mensaje_dias = _escribir('usp_alumna_dias_guardar', [
            texto(payload.get('IDALUMNA'), 50),
            texto(payload.get('DIASASISTENCIA'), 120),
        ])
        if not ok_dias:
            return ok, f'{mensaje} Pero no se guardaron los días: {mensaje_dias}', nuevo_id
    return ok, mensaje, nuevo_id


def actualizar_mensualidad(id_registro, payload):
    return _escribir('usp_mensualidad_actualizar', [id_registro, *_mensualidad_valores(payload)])


def eliminar_mensualidad(id_registro):
    return _escribir('usp_mensualidad_eliminar', [id_registro])


def listar_pagos(params):
    return _listar('usp_pago_listar', _paginacion(params, extras=[*_rango(params), params.get('idciclo') or None]))


def obtener_pago(id_registro):
    return _uno('usp_pago_obtener', id_registro)


def _pago_valores(payload):
    return [
        texto(payload.get('IDALUMNA'), 50),
        texto(payload.get('IDMENSUALIDAD'), 50),
        texto(payload.get('FECHA'), 8),
        texto(payload.get('MONTO')),
        texto(payload.get('MEDIO'), 30, mayusculas=False),
    ]


def insertar_pago(payload):
    return _escribir('usp_pago_insertar', _pago_valores(payload))


def actualizar_pago(id_registro, payload):
    return _escribir('usp_pago_actualizar', [id_registro, *_pago_valores(payload)])


def eliminar_pago(id_registro):
    return _escribir('usp_pago_eliminar', [id_registro])


def _fecha_param(valor):
    texto_fecha = str(valor or '').strip()
    if len(texto_fecha) == 10 and texto_fecha[4] == '-' and texto_fecha[7] == '-':
        return f'{texto_fecha[8:10]}{texto_fecha[5:7]}{texto_fecha[0:4]}'
    if len(texto_fecha) == 8 and texto_fecha.isdigit():
        return texto_fecha
    return None


def listar_ventas(params):
    return _listar('usp_venta_listar', _paginacion(params, extras=[
        *_rango(params),
        params.get('idciclo') or None,
        params.get('tipo') or None,
        texto(params.get('producto'), 150, mayusculas=False),
        params.get('saldo') or None,
    ]))


def obtener_venta(id_registro):
    fila = _uno('usp_venta_obtener', id_registro)
    if not fila:
        return None
    with connection.cursor() as cursor:
        detalle = sp.call_simple(cursor, 'usp_venta_detalle_listar', [id_registro])
    fila['DETALLE'] = jsonable(detalle)
    if not fila['DETALLE'] and fila.get('PRODUCTO'):
        fila['DETALLE'] = [{
            'PRODUCTO': fila.get('PRODUCTO'),
            'TALLA': fila.get('TALLA'),
            'PRECIO': fila.get('PRECIO'),
            'ORDEN': 1,
        }]
    return fila


def abonos_venta(id_venta):
    venta = _uno('usp_venta_obtener', id_venta)
    if not venta:
        return None
    with connection.cursor() as cursor:
        abonos = jsonable(sp.call_simple(cursor, 'usp_venta_abono_listar', [id_venta]))
    return {
        'venta': {k: venta.get(k) for k in (
            'IDVENTA', 'NUMERO', 'NOMBRE', 'IDALUMNA', 'TIPO', 'PRODUCTO', 'PRECIO', 'PAGADO', 'SALDO',
            'ESTADO_RECIBO', 'FECHA', 'MEDIO',
        )},
        'abonos': abonos,
    }


def registrar_abono(id_venta, payload):
    return _escribir('usp_venta_abono_insertar', [
        id_venta,
        _fecha_param(payload.get('FECHA')),
        texto(payload.get('MONTO')),
        texto(payload.get('MEDIO'), 30, mayusculas=False),
        texto(payload.get('OBSERVACION'), 300),
    ])


def anular_abono(id_abono):
    return _escribir('usp_venta_abono_eliminar', [id_abono])


def _lineas_venta(payload, tipo):
    if tipo == 'Servicio':
        crudas = [{
            'PRODUCTO': payload.get('PRODUCTO'),
            'PRECIO': payload.get('PRECIO'),
            'TALLA': None,
        }]
    else:
        crudas = payload.get('DETALLE') or []
        if not isinstance(crudas, list):
            crudas = []
    lineas = []
    for item in crudas:
        if not isinstance(item, dict):
            continue
        producto = texto(item.get('PRODUCTO'), 150, mayusculas=False)
        if not producto:
            continue
        producto = producto.replace(';', ',').replace('|', '/')
        try:
            monto = float(item.get('PRECIO') if item.get('PRECIO') not in (None, '') else 0)
        except (TypeError, ValueError):
            monto = 0
        talla = '' if tipo == 'Servicio' else (texto(item.get('TALLA'), 5, mayusculas=False) or '')
        lineas.append(f"{producto}||{monto}||{talla}")
    return ';;'.join(lineas)


def _venta_valores(payload):
    tipo = texto(payload.get('TIPO'), 30, mayusculas=False) or 'Producto físico'
    if tipo != 'Servicio':
        tipo = 'Producto físico'
    return [
        texto(payload.get('NOMBRE'), 200),
        texto(payload.get('PRODUCTO'), 150, mayusculas=False),
        tipo,
        texto(payload.get('IDTURNO'), 50),
        None if tipo == 'Servicio' else texto(payload.get('TALLA'), 5, mayusculas=False),
        texto(payload.get('OBSERVACION'), 500),
        texto(payload.get('PRECIO')),
        texto(payload.get('MEDIO'), 30, mayusculas=False),
        texto(payload.get('FECHA'), 8),
        _lineas_venta(payload, tipo),
        texto(payload.get('ACUENTA')),
        texto(payload.get('IDUSUARIO_ACCION'), 50, mayusculas=False) or '',
    ]


def insertar_venta(payload):
    valores = _venta_valores(payload)
    if not valores[-3]:
        return 0, 'Selecciona cada artículo y su importe.'
    return _escribir('usp_venta_insertar', valores)


def actualizar_venta(id_registro, payload):
    valores = _venta_valores(payload)
    if not valores[-3]:
        return 0, 'Selecciona cada artículo y su importe.'
    return _escribir('usp_venta_actualizar', [id_registro, *valores])


def eliminar_venta(id_registro, usuario=None):
    return _escribir('usp_venta_eliminar', [id_registro, texto(usuario, 50, mayusculas=False) or ''])


def anular_venta(id_registro, usuario=None):
    return _escribir('usp_venta_anular', [id_registro, texto(usuario, 50, mayusculas=False) or ''])


def listar_egresos(params):
    return _listar('usp_egreso_listar', _paginacion(params, extras=_rango(params)))


def obtener_egreso(id_registro):
    return _uno('usp_egreso_obtener', id_registro)


def _egreso_valores(payload):
    return [
        texto(payload.get('FECHA'), 8),
        texto(payload.get('CONCEPTO'), 200),
        texto(payload.get('PROVEEDOR'), 200),
        texto(payload.get('MONTO')),
        texto(payload.get('MEDIO'), 30, mayusculas=False),
        texto(payload.get('OBSERVACIONES'), 500),
    ]


def insertar_egreso(payload):
    return _escribir('usp_egreso_insertar', _egreso_valores(payload))


def actualizar_egreso(id_registro, payload):
    return _escribir('usp_egreso_actualizar', [id_registro, *_egreso_valores(payload)])


def eliminar_egreso(id_registro):
    return _escribir('usp_egreso_eliminar', [id_registro])


def listar_auditoria(params):
    extras = _rango(params) + [texto(params.get('operacion'), 10)]
    return _listar('usp_auditoria_listar', _paginacion(params, extras=extras))


def obtener_auditoria(id_registro):
    fila = _uno('usp_auditoria_obtener', id_registro)
    if fila:
        for campo in ('VALORANTERIOR', 'VALORNUEVO'):
            if isinstance(fila.get(campo), str):
                fila[campo] = json.loads(fila[campo])
    return fila


ORDENAN_EN_SP = {listar_auditoria}


def asistencia_dia(fecha, id_turno, buscar='', todas=False):
    with connection.cursor() as cursor:
        rows = sp.call_simple(cursor, 'usp_asistencia_dia', [
            fecha, id_turno or None, str(buscar or '').strip()[:100], 1 if todas else 0,
        ])
    return jsonable(rows)


def marcar_asistencia(payload):
    return _escribir('usp_asistencia_marcar', [
        texto(payload.get('IDALUMNA'), 50),
        texto(payload.get('FECHA'), 8),
        texto(payload.get('ESTADO'), 20, mayusculas=False),
    ])


def dashboard():
    with connection.cursor() as cursor:
        resumen = sp.call_simple(cursor, 'usp_dashboard_resumen', [])
    return {
        'resumen': jsonable(resumen[0] if resumen else {}),
    }


def dashboard_matriculas(params):
    desde = _fecha_param(params.get('desde'))
    hasta = _fecha_param(params.get('hasta'))
    if not desde or not hasta:
        raise ValueError('Indica las fechas desde y hasta')
    with connection.cursor() as cursor:
        filas = jsonable(sp.call_simple(cursor, 'usp_dashboard_matriculas', [desde, hasta]))
    nuevas = [f for f in filas if f.get('TIPO') == 'Matrícula nueva']
    return {
        'nuevas': len(nuevas),
        'mensualidades': len(filas) - len(nuevas),
        'detalle': filas,
    }


def dashboard_asistencias(params):
    desde = _fecha_param(params.get('desde'))
    hasta = _fecha_param(params.get('hasta'))
    if not desde or not hasta:
        raise ValueError('Indica las fechas desde y hasta')
    with connection.cursor() as cursor:
        turnos = jsonable(sp.call_simple(cursor, 'usp_dashboard_asistencias', [desde, hasta, params.get('idturno') or None]))
    totales = {
        clave: sum(int(fila.get(clave) or 0) for fila in turnos)
        for clave in ('PRESENTES', 'FALTAS', 'TARDANZAS')
    }
    return {'turnos': turnos, 'totales': totales}


MESES_DASHBOARD = (3, 6, 12)


def dashboard_finanzas(params):
    try:
        meses = int(params.get('meses') or 6)
    except (TypeError, ValueError):
        meses = 6
    if meses not in MESES_DASHBOARD:
        meses = 6
    with connection.cursor() as cursor:
        return {'meses': jsonable(sp.call_simple(cursor, 'usp_dashboard_finanzas', [meses]))}


def listar_promociones(params):
    return _listar('usp_promocion_listar', _paginacion(params))


def obtener_promocion(id_registro):
    return _uno('usp_promocion_obtener', id_registro)


def _promocion_valores(payload):
    return [
        texto(payload.get('NOMBRE'), 120),
        texto(payload.get('TIPO'), 30, mayusculas=False),
        texto(payload.get('MONTOREGULAR')),
        texto(payload.get('MONTOPROMOCIONAL')),
        entero(payload.get('MESESPROMOCION')),
        texto(payload.get('MONTOSIGUIENTES')),
        texto(payload.get('FECHAINICIO'), 8),
        texto(payload.get('FECHAFIN'), 8),
        texto(payload.get('CONDICIONES'), 500),
        texto(payload.get('ACTIVO'), 20, mayusculas=False),
    ]


def insertar_promocion(payload):
    return _escribir('usp_promocion_insertar', _promocion_valores(payload))


def actualizar_promocion(id_registro, payload):
    return _escribir('usp_promocion_actualizar', [id_registro, *_promocion_valores(payload)])


def eliminar_promocion(id_registro):
    return _escribir('usp_promocion_eliminar', [id_registro])


def cumpleanos(params):
    seccion = params.get('seccion') or 'mes'
    id_ciclo = str(params.get('idciclo') or '').strip()[:50] or None
    try:
        mes = int(params.get('mes') or date.today().month)
    except (TypeError, ValueError):
        mes = date.today().month
    if not 1 <= mes <= 12:
        raise ValueError('Mes no válido')
    with connection.cursor() as cursor:
        if seccion == 'conteo':
            fila = jsonable(sp.call_simple(cursor, 'usp_cumpleanos_conteo', [mes, id_ciclo]))
            totales = fila[0] if fila else {}
            return {clave.lower(): int(totales.get(clave) or 0) for clave in ('HOY', 'SEMANA', 'MES')}
        if seccion == 'hoy':
            return jsonable(sp.call_simple(cursor, 'usp_cumpleanos_hoy', [id_ciclo]))
        if seccion == 'semana':
            return jsonable(sp.call_simple(cursor, 'usp_cumpleanos_semana', [id_ciclo]))
        if seccion == 'mes':
            return jsonable(sp.call_simple(cursor, 'usp_cumpleanos_mes', [mes, id_ciclo]))
    raise ValueError('Sección no válida')


def buscar_general(texto_buscar):
    with connection.cursor() as cursor:
        return jsonable(sp.call_simple(cursor, 'usp_alumna_buscar_general', [str(texto_buscar or '').strip()[:100]]))


def alumnas_combo(params):
    texto_buscar = str(params.get('q') or '').strip()[:100]
    id_alumna = str(params.get('id') or '').strip()[:50]
    try:
        limite = int(params.get('limite') or 20)
    except (TypeError, ValueError):
        limite = 20
    with connection.cursor() as cursor:
        filas = sp.call_simple(cursor, 'usp_alumna_combo', [texto_buscar, id_alumna, limite])
    return [
        {'value': f['IDALUMNA'], 'label': f['NOMBRE'], 'dni': f['DNI'], 'email': f['EMAIL'], 'telefono': f['TELEFONO']}
        for f in jsonable(filas)
    ]


def mensualidades_por_alumna(id_alumna):
    if not id_alumna:
        return []
    with connection.cursor() as cursor:
        filas = sp.call_simple(cursor, 'usp_mensualidad_por_alumna', [str(id_alumna).strip()[:50]])
    return [
        {'value': f['IDMENSUALIDAD'], 'idalumna': f['IDALUMNA'], 'inicio': f['FECHAINICIO'], 'fin': f['FECHAFIN'],
         'estado': f['ESTADO'], 'monto': float(f['MONTO'] or 0), 'saldo': float(f['SALDO'] or 0)}
        for f in jsonable(filas)
    ]


def estado_cuenta(id_alumna):
    with connection.cursor() as cursor:
        sets = [_sin_orden(s) for s in sp.call_sets(cursor, 'usp_estado_cuenta', [id_alumna])]
    while len(sets) < 6:
        sets.append([])
    alumna, mensualidades, pagos, ventas, productos, abonos = sets[:6]
    if not alumna:
        return None
    saldo_men = sum(m.get('SALDO') or 0 for m in mensualidades)
    saldo_ven = sum(v.get('SALDO') or 0 for v in ventas)
    return {
        'alumna': alumna[0],
        'mensualidades': mensualidades,
        'pagos': pagos,
        'ventas': ventas,
        'productos': productos,
        'abonos': abonos,
        'resumen': {
            'pagadas': sum(1 for m in mensualidades if m.get('ESTADO') == 'Completada'),
            'pendientes': sum(1 for m in mensualidades if m.get('ESTADO') in ('Deuda', 'Parcial')),
            'vencidas': sum(1 for m in mensualidades if m.get('VENCIDA')),
            'saldoMensualidades': round(saldo_men, 2),
            'saldoVentas': round(saldo_ven, 2),
            'deudaTotal': round(saldo_men + saldo_ven, 2),
            'totalPagado': round(sum(p.get('MONTO') or 0 for p in pagos)
                                 + sum(v.get('PAGADO') or 0 for v in ventas if v.get('ESTADO_RECIBO') == 'Emitido'), 2),
            'descuentos': round(sum(m.get('DESCUENTO') or 0 for m in mensualidades), 2),
        },
    }


SECCIONES_ESTADO_CUENTA = {
    'mensualidades': (('MONTO', 'DESCUENTO', 'PAGADO', 'SALDO'),
                      ('FECHAINICIO', 'FECHAFIN', 'MONTOREGULAR', 'MONTO', 'DESCUENTO', 'PAGADO', 'SALDO',
                       'ESTADO', 'PROMOCION')),
    'pagos': (('MONTO',), ('FECHA', 'IDPAGO', 'FECHAPERIODO', 'MONTO', 'MEDIO', 'PARCIAL')),
    'ventas': (('PRECIO', 'PAGADO', 'SALDO'),
               ('FECHA', 'NUMERO', 'TIPO', 'PRODUCTO', 'PRECIO', 'PAGADO', 'SALDO', 'MEDIO', 'ESTADO_RECIBO')),
    'abonos': (('MONTO',), ('FECHA', 'NUMERO', 'PRODUCTO', 'PRECIO', 'ORIGEN', 'MONTO', 'MEDIO', 'SALDO')),
    'productos': (('PRECIO',), ('FECHA', 'NUMERO', 'PRODUCTO', 'TALLA', 'PRECIO')),
}


def estado_cuenta_seccion(id_alumna, seccion, params):
    if seccion not in SECCIONES_ESTADO_CUENTA:
        raise ValueError('Sección no válida')
    sumables, ordenables = SECCIONES_ESTADO_CUENTA[seccion]
    estado = str(params.get('estado') or '').strip().lower()
    estado = estado if seccion == 'mensualidades' and estado in ('pagadas', 'pendientes') else ''
    with connection.cursor() as cursor:
        filas = _sin_orden(sp.call_simple(cursor, 'usp_estado_cuenta_seccion',
                                          [id_alumna, seccion, estado, *_orden_params(params, ordenables)]))
    base = [f for f in filas if f.get('ESTADO_RECIBO') == 'Emitido'] if seccion == 'ventas' else filas
    totales = {clave: round(sum(float(f.get(clave) or 0) for f in base), 2) for clave in sumables}
    total = len(filas)
    pagina, tamanio = 1, total
    if str(params.get('todo') or '') != '1':
        pagina, tamanio = _paginacion_simple(params)
        filas = filas[(pagina - 1) * tamanio: pagina * tamanio]
    return {'filas': filas, 'totales': totales, 'total': total, 'pagina': pagina, 'tamanio': tamanio}


def _deudas_filtros(params):
    try:
        dias = max(1, min(int(params.get('dias') or 7), 60))
    except (TypeError, ValueError):
        dias = 7
    buscar = str(params.get('buscar') or '').strip()[:100]
    id_ciclo = str(params.get('idciclo') or '').strip()[:50]
    return dias, buscar, id_ciclo


def deudas_conteo(params):
    dias, buscar, id_ciclo = _deudas_filtros(params)
    with connection.cursor() as cursor:
        filas = jsonable(sp.call_simple(cursor, 'usp_deudas_conteo', [dias, buscar, id_ciclo]))
    t = filas[0] if filas else {}
    mensualidades = float(t.get('MONTOMENSUALIDADES') or 0)
    productos = float(t.get('PRODUCTOS') or 0)
    servicios = float(t.get('SERVICIOS') or 0)
    return {
        'alumnas': int(t.get('ALUMNAS') or 0),
        'mensualidadesConSaldo': int(t.get('MENSUALIDADES') or 0),
        'proximas': int(t.get('PROXIMAS') or 0),
        'ventas': int(t.get('VENTAS') or 0),
        'vencidas': int(t.get('VENCIDAS') or 0),
        'montoVencido': round(float(t.get('MONTOVENCIDO') or 0), 2),
        'mensualidades': round(mensualidades, 2),
        'productos': round(productos, 2),
        'servicios': round(servicios, 2),
        'porCobrar': round(mensualidades + productos + servicios, 2),
    }


def _tipo_venta(params):
    tipo = str(params.get('tipo') or '').strip()
    return tipo if tipo in ('Producto físico', 'Servicio') else None


def deudas(params):
    seccion = params.get('seccion') or 'alumnas'
    if seccion == 'conteo':
        return deudas_conteo(params)
    dias, buscar, id_ciclo = _deudas_filtros(params)
    procedimientos = {
        'alumnas': ('usp_deudas_alumnas', [buscar, id_ciclo], ('MENSUALIDADES', 'PRODUCTOS', 'SERVICIOS', 'TOTAL'),
                    ('ALUMNA', 'CICLO', 'VENCIDAS', 'MENSUALIDADES', 'PRODUCTOS', 'SERVICIOS', 'TOTAL')),
        'mensualidades': ('usp_deudas_mensualidades', [buscar, id_ciclo], ('MONTO', 'PAGADO', 'SALDO'),
                          ('ALUMNA', 'CICLO', 'FECHAINICIO', 'FECHAFIN', 'MONTO', 'PAGADO', 'SALDO', 'SITUACION')),
        'proximas': ('usp_deudas_proximas', [dias, buscar, id_ciclo], (),
                     ('ALUMNA', 'CICLO', 'FECHAINICIO', 'FECHAFIN', 'DIAS')),
        'ventas': ('usp_deudas_ventas', [buscar, id_ciclo, _tipo_venta(params)], ('PRECIO', 'PAGADO', 'SALDO'),
                   ('NUMERO', 'FECHA', 'ALUMNA', 'TIPO', 'PRODUCTO', 'PRECIO', 'PAGADO', 'SALDO')),
    }
    if seccion not in procedimientos:
        raise ValueError('Sección no válida')
    nombre, argumentos, sumables, ordenables = procedimientos[seccion]
    with connection.cursor() as cursor:
        filas = _sin_orden(sp.call_simple(cursor, nombre, argumentos + _orden_params(params, ordenables)))
    totales = {clave: round(sum(float(f.get(clave) or 0) for f in filas), 2) for clave in sumables}
    total = len(filas)
    pagina, tamanio = 1, total
    if str(params.get('todo') or '') != '1':
        pagina, tamanio = _paginacion_simple(params)
        filas = filas[(pagina - 1) * tamanio: pagina * tamanio]
    return {'filas': filas, 'totales': totales, 'total': total, 'pagina': pagina, 'tamanio': tamanio}


TABLAS_TRAZA = {
    'alumnas': 'ALUMNA', 'mensualidades': 'MENSUALIDAD', 'pagos': 'PAGO', 'ventas': 'VENTA',
    'egresos': 'EGRESO', 'usuarios': 'USUARIO', 'promociones': 'PROMOCION',
}


def trazabilidad(entidad, id_registro):
    tabla = TABLAS_TRAZA.get(entidad)
    if not tabla or not id_registro:
        return []
    with connection.cursor() as cursor:
        return jsonable(sp.call_simple(cursor, 'usp_trazabilidad', [tabla, id_registro]))


_F, _M, _T, _E = 'fecha', 'moneda', 'texto', 'entero'

REPORTES = {
    'matriculas': ('Matrículas', [
        ('FECHA', 'Fecha', _F), ('ALUMNA', 'Alumna', _T), ('DNI', 'DNI', _T), ('CICLO', 'Categoría', _T),
        ('TURNO', 'Turno', _T), ('ESTADO', 'Estado', _T), ('MONTO', 'Primera mensualidad', _M),
        ('REGISTRADOPOR', 'Registrado por', _T)]),
    'mensualidades': ('Mensualidades', [
        ('ALUMNA', 'Alumna', _T), ('CICLO', 'Categoría', _T), ('FECHAINICIO', 'Inicio', _F), ('FECHAFIN', 'Fin', _F),
        ('MONTOREGULAR', 'Tarifa regular', _M), ('MONTO', 'Monto', _M), ('DESCUENTO', 'Descuento', _M),
        ('PAGADO', 'Pagado', _M), ('SALDO', 'Saldo', _M), ('ESTADO', 'Estado', _T), ('PROMOCION', 'Promoción', _T)]),
    'ventas': ('Ventas', [
        ('NUMERO', 'N.°', _T), ('FECHA', 'Fecha', _F), ('NOMBRE', 'Cliente', _T), ('CICLO', 'Categoría', _T),
        ('TIPO', 'Tipo', _T), ('PRODUCTO', 'Detalle', _T), ('PRECIO', 'Total', _M), ('PAGADO', 'Pagado', _M),
        ('SALDO', 'Saldo', _M), ('MEDIO', 'Medio', _T), ('ESTADO', 'Estado', _T), ('REGISTRADOPOR', 'Registrado por', _T)]),
    'productos': ('Productos vendidos', [
        ('PRODUCTO', 'Producto', _T), ('TALLA', 'Talla', _T), ('CANTIDAD', 'Cantidad', _E), ('TOTAL', 'Total', _M)]),
    'clases': ('Clases individuales', [
        ('FECHA', 'Fecha', _F), ('NUMERO', 'N.°', _T), ('NOMBRE', 'Alumna', _T), ('CICLO', 'Categoría', _T),
        ('PRECIO', 'Total', _M), ('PAGADO', 'Pagado', _M), ('SALDO', 'Saldo', _M), ('MEDIO', 'Medio', _T),
        ('REGISTRADOPOR', 'Registrado por', _T)]),
    'pagos': ('Pagos de mensualidades', [
        ('FECHA', 'Fecha', _F), ('IDPAGO', 'Código', _T), ('ALUMNA', 'Alumna', _T), ('CICLO', 'Categoría', _T),
        ('PERIODO', 'Periodo', _T), ('MONTO', 'Monto', _M), ('MEDIO', 'Medio', _T), ('REGISTRADOPOR', 'Registrado por', _T)]),
    'saldos': ('Saldos pendientes', [
        ('TIPO', 'Tipo', _T), ('ALUMNA', 'Alumna', _T), ('CICLO', 'Categoría', _T), ('CONCEPTO', 'Concepto', _T),
        ('FECHA', 'Fecha', _F), ('TOTAL', 'Total', _M), ('PAGADO', 'Pagado', _M), ('SALDO', 'Saldo', _M)]),
    'activas': ('Alumnas activas', [
        ('ALUMNA', 'Alumna', _T), ('DNI', 'DNI', _T), ('CICLO', 'Categoría', _T), ('TURNO', 'Turno', _T),
        ('TELEFONO', 'Teléfono', _T), ('APODERADO', 'Apoderado', _T), ('TELAPODERADO', 'Tel. apoderado', _T),
        ('FECHAINSCRIPCION', 'Inscripción', _F), ('FINMENSUALIDAD', 'Fin de mensualidad', _F)]),
    'retiradas': ('Alumnas inactivas o retiradas', [
        ('ALUMNA', 'Alumna', _T), ('DNI', 'DNI', _T), ('CICLO', 'Categoría', _T), ('ESTADO', 'Estado', _T),
        ('FECHARETIRO', 'Fecha de retiro', _F), ('MOTIVORETIRO', 'Motivo', _T), ('TELAPODERADO', 'Tel. apoderado', _T)]),
    'cumpleanos': ('Cumpleaños', [
        ('FECHANACIMIENTO', 'Nacimiento', _F), ('ALUMNA', 'Alumna', _T), ('EDAD', 'Edad', _E),
        ('CICLO', 'Categoría', _T), ('TURNO', 'Turno', _T), ('APODERADO', 'Apoderado', _T),
        ('TELAPODERADO', 'Tel. apoderado', _T)]),
    'ingresos': ('Ingresos por categoría', [
        ('CICLO', 'Categoría', _T), ('PAGOS', 'Mensualidades', _M), ('VENTAS', 'Ventas', _M), ('TOTAL', 'Total', _M)]),
    'abonos': ('Abonos de ventas', [
        ('FECHA', 'Fecha', _F), ('NUMERO', 'Recibo', _T), ('NOMBRE', 'Cliente', _T), ('CICLO', 'Categoría', _T),
        ('PRODUCTO', 'Detalle', _T), ('ORIGEN', 'Tipo de pago', _T), ('MONTO', 'Monto', _M), ('MEDIO', 'Medio', _T),
        ('SALDO', 'Saldo actual', _M), ('REGISTRADOPOR', 'Registrado por', _T)]),
    'asistencias': ('Asistencias por alumna', [
        ('ALUMNA', 'Alumna', _T), ('CICLO', 'Categoría', _T), ('TURNO', 'Turno', _T),
        ('PRESENTES', 'Presentes', _E), ('FALTAS', 'Faltas', _E), ('REGISTROS', 'Clases registradas', _E),
        ('PORCENTAJE', '% asistencia', _E)]),
}


def reporte(tipo, params):
    if tipo not in REPORTES:
        raise ValueError('Reporte no disponible')
    titulo, columnas = REPORTES[tipo]
    with connection.cursor() as cursor:
        filas = _sin_orden(sp.call_simple(cursor, 'usp_reporte', [
            tipo,
            _fecha_param(params.get('desde')),
            _fecha_param(params.get('hasta')),
            params.get('idciclo') or None,
        ] + _orden_params(params, [clave for clave, _, _ in columnas])))
    sumables = [f for f in filas if f.get('ESTADO') == 'Emitido'] if tipo == 'ventas' else filas
    totales = {}
    for clave, _, formato in columnas:
        if tipo == 'abonos' and clave == 'SALDO':
            continue
        if formato == _M or (formato == _E and clave in ('CANTIDAD', 'PRESENTES', 'FALTAS', 'REGISTROS')):
            totales[clave] = round(sum(f.get(clave) or 0 for f in sumables), 2)
    total = len(filas)
    pagina, tamanio = 1, total
    if str(params.get('todo') or '') != '1':
        pagina, tamanio = _paginacion_simple(params)
        filas = filas[(pagina - 1) * tamanio: pagina * tamanio]
    return {
        'tipo': tipo,
        'titulo': titulo,
        'columnas': [{'key': k, 'label': l, 'formato': f} for k, l, f in columnas],
        'filas': filas,
        'totales': totales,
        'total': total,
        'pagina': pagina,
        'tamanio': tamanio,
    }


def _col(clave, etiqueta, formato, **extra):
    return {'key': clave, 'label': etiqueta, 'formato': formato, **extra}


def _detalle(titulo, columnas, filas, params, sumar=()):
    totales = {clave: round(sum(float(f.get(clave) or 0) for f in filas), 2) for clave in sumar}
    total = len(filas)
    pagina, tamanio = 1, total
    if str(params.get('todo') or '') != '1':
        pagina, tamanio = _paginacion_simple(params)
        filas = filas[(pagina - 1) * tamanio: pagina * tamanio]
    return {
        'titulo': titulo,
        'columnas': columnas,
        'filas': filas,
        'totales': totales,
        'total': total,
        'pagina': pagina,
        'tamanio': tamanio,
    }


def _mes_param(params):
    valor = str(params.get('mes') or '').strip()
    if len(valor) == 7 and valor[4] == '-' and valor[:4].isdigit() and valor[5:].isdigit():
        anio, mes = int(valor[:4]), int(valor[5:])
        if 2000 <= anio <= 2100 and 1 <= mes <= 12:
            return anio, mes
    if valor:
        raise ValueError('Mes no válido')
    hoy = date.today()
    return hoy.year, hoy.month


def _filtro(params, clave):
    return str(params.get(clave) or '').strip() or None


COLUMNAS_REPORTE_ALUMNAS = [
    _col('ALUMNA', 'Nombre', _T), _col('EDAD', 'Edad', _E), _col('DNI', 'DNI', _T), _col('EMAIL', 'Email', _T),
    _col('TELEFONO', 'Contacto', _T), _col('CICLO', 'Categoría', _T), _col('TURNO', 'Turno', _T),
    _col('HORARIO', 'Horario', _T), _col('DIAS', 'Días de asistencia', _T), _col('ESTADO', 'Estado', _T),
    _col('CUOTA', 'Cuota mensual', _M), _col('FECHAINSCRIPCION', 'Inscripción', _F),
    _col('FECHAINICIO', 'Inicio mensualidad', _F), _col('FECHAFIN', 'Fin mensualidad', _F),
    _col('FECHARETIRO', 'Retiro', _F),
]


def _reporte_alumnas(params):
    ordenables = [c['key'] for c in COLUMNAS_REPORTE_ALUMNAS]
    with connection.cursor() as cursor:
        filas = _sin_orden(sp.call_simple(cursor, 'usp_reporte_alumnas', [
            _filtro(params, 'buscar'), _filtro(params, 'estado'), _filtro(params, 'idciclo'),
            _filtro(params, 'idturno'), *_orden_params(params, ordenables),
        ]))
    return _detalle('Listado de alumnas', COLUMNAS_REPORTE_ALUMNAS, filas, params)


DIAS_SEMANA_CORTOS = ('LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO')
MARCAS_ASISTENCIA = {'Presente': 'A', 'Tarde': 'T', 'Ausente': 'F'}


def _texto_pago_mensualidad(fila):
    monto = fila.get('MONTOMENSUALIDAD')
    if monto is None:
        return 'SIN MENSUALIDAD', None
    if float(monto) <= 0:
        return 'SIN MONTO DE MENSUALIDAD', None
    fin = str(fila.get('FECHAFINMENSUALIDAD') or '')
    partes = [f'S/ {float(monto):.2f}']
    if len(fin) == 8:
        partes.append(f'FIN {fin[:2]}/{fin[2:4]}/{fin[4:]}')
    saldo = float(fila.get('SALDO') or 0)
    partes.append(f'DEBE S/ {saldo:.2f}' if saldo > 0 else 'PAGADO')
    return ' · '.join(partes), 'peligro' if saldo > 0 else 'ok'


def _reporte_asistencia_mensual(params):
    anio, mes = _mes_param(params)
    dias_mes = calendar.monthrange(anio, mes)[1]
    ordenables = ['ALUMNA', 'CICLO', 'TURNO', 'HORARIO', 'PRESENTES', 'TARDES', 'FALTAS', 'SALDO']
    with connection.cursor() as cursor:
        sets = sp.call_sets(cursor, 'usp_reporte_asistencia_mensual', [
            anio, mes, _filtro(params, 'buscar'), _filtro(params, 'idciclo'), _filtro(params, 'idturno'),
            *_orden_params(params, ordenables),
        ])
    alumnas = _sin_orden(sets[0]) if sets else []
    marcas = {}
    for marca in jsonable(sets[1]) if len(sets) > 1 else []:
        marcas.setdefault(marca['IDALUMNA'], {})[int(marca['DIA'])] = MARCAS_ASISTENCIA.get(marca['ESTADO'], '')
    for fila in alumnas:
        dias = marcas.get(fila['IDALUMNA'], {})
        for dia in range(1, dias_mes + 1):
            fila[f'D{dia:02d}'] = dias.get(dia, '')
        fila['PAGO'], fila['PAGOTONO'] = _texto_pago_mensualidad(fila)

    columnas_dias = []
    for dia in range(1, dias_mes + 1):
        semana = date(anio, mes, dia).weekday()
        columnas_dias.append(_col(f'D{dia:02d}', f'{DIAS_SEMANA_CORTOS[semana]} {dia:02d}', _T,
                                  dia=dia, domingo=semana == 6, ordenable=False))
    columnas = [
        _col('ALUMNA', 'Nombres y apellidos', _T),
        _col('APODERADO', 'Apoderado', _T, soloExportar=True),
        _col('TELAPODERADO', 'Tel. apoderado', _T, soloExportar=True),
        _col('TELEFONO', 'Tel. alumna', _T, soloExportar=True),
        _col('TURNO', 'Turno', _T),
        _col('HORARIO', 'Horario', _T, soloExportar=True),
        *columnas_dias,
        _col('PRESENTES', 'Asist.', _E),
        _col('TARDES', 'Tard.', _E),
        _col('FALTAS', 'Faltas', _E),
        _col('PAGO', 'Pago mensualidad', _T, campoOrden='SALDO'),
    ]
    data = _detalle(f'Asistencia mensual — {MESES[mes - 1]} {anio}', columnas, alumnas, params,
                    sumar=('PRESENTES', 'TARDES', 'FALTAS'))
    data['mes'] = f'{anio}-{mes:02d}'
    return data


COLUMNAS_EGRESOS_MES = [
    _col('FECHA', 'Fecha', _F), _col('CONCEPTO', 'Concepto', _T), _col('PROVEEDOR', 'Proveedor', _T),
    _col('MONTO', 'Monto', _M), _col('MEDIO', 'Medio de pago', _T), _col('OBSERVACIONES', 'Observaciones', _T),
]


def _reporte_ingresos_egresos(params):
    anio, mes = _mes_param(params)
    ordenables = [c['key'] for c in COLUMNAS_EGRESOS_MES]
    with connection.cursor() as cursor:
        sets = sp.call_sets(cursor, 'usp_reporte_financiero', [anio, mes, *_orden_params(params, ordenables)])
    resumen = jsonable(sets[0])[0] if sets and sets[0] else {}
    egresos = _sin_orden(sets[1]) if len(sets) > 1 else []
    data = _detalle(f'Ingresos y egresos — {MESES[mes - 1]} {anio}', COLUMNAS_EGRESOS_MES, egresos, params,
                    sumar=('MONTO',))
    data['resumen'] = resumen
    data['mes'] = f'{anio}-{mes:02d}'
    return data


COLUMNAS_HISTORIAL_PAGOS = [
    _col('FECHA', 'Fecha', _F), _col('TIPO', 'Tipo', _T), _col('CODIGO', 'Código', _T), _col('ALUMNA', 'Alumna', _T),
    _col('CICLO', 'Categoría', _T), _col('DETALLE', 'Detalle', _T), _col('MONTO', 'Monto', _M),
    _col('MEDIO', 'Método', _T), _col('ESTADO', 'Estado', _T),
]


def _reporte_historial_pagos(params):
    tipo = _filtro(params, 'tipo')
    if tipo not in (None, 'mensualidades', 'ventas'):
        raise ValueError('Tipo no válido')
    ordenables = [c['key'] for c in COLUMNAS_HISTORIAL_PAGOS]
    with connection.cursor() as cursor:
        filas = _sin_orden(sp.call_simple(cursor, 'usp_reporte_historial_pagos', [
            _filtro(params, 'buscar'), tipo, _fecha_param(params.get('desde')), _fecha_param(params.get('hasta')),
            _filtro(params, 'idciclo'), *_orden_params(params, ordenables),
        ]))
    return _detalle('Historial de pagos', COLUMNAS_HISTORIAL_PAGOS, filas, params, sumar=('MONTO',))


MESES = ('Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
         'Septiembre', 'Octubre', 'Noviembre', 'Diciembre')

REPORTES_DETALLE = {
    'alumnas': _reporte_alumnas,
    'asistencia-mensual': _reporte_asistencia_mensual,
    'ingresos-egresos': _reporte_ingresos_egresos,
    'historial-pagos': _reporte_historial_pagos,
}


def reporte_detalle(tipo, params):
    generar = REPORTES_DETALLE.get(tipo)
    if not generar:
        raise ValueError('Reporte no disponible')
    return generar(params)


def _orden_params(params, permitidas):
    columna = str(params.get('ordenarPor') or '').strip().upper()
    if columna not in permitidas:
        return ['', '']
    direccion = 'DESC' if str(params.get('direccion') or '').strip().upper() == 'DESC' else 'ASC'
    return [columna, direccion]


def _sin_orden(filas):
    filas = jsonable(filas)
    for fila in filas:
        fila.pop('ORDEN', None)
    return filas


def _paginacion_simple(params):
    try:
        pagina = max(1, int(params.get('pagina') or 1))
    except (TypeError, ValueError):
        pagina = 1
    try:
        tamanio = int(params.get('tamanio') or 10)
    except (TypeError, ValueError):
        tamanio = 10
    return pagina, tamanio if tamanio in (10, 20, 30, 50) else 10


def avisos(funciones):
    mensajes = []
    hoy = date.today().strftime('%d%m%Y')
    if 'VER_SALDOS' in funciones:
        datos = deudas_conteo({'dias': 7})
        if datos['vencidas']:
            mensajes.append({
                'IDMENSAJE': 'deudas-vencidas', 'TITULO': 'Mensualidades vencidas', 'CARGO': 'Deudas',
                'MENSAJE': f"{datos['vencidas']} mensualidades vencidas por S/ {datos['montoVencido']:.2f}. "
                           f"Total por cobrar: S/ {datos['porCobrar']:.2f}.",
                'PAGINA': 'deudas',
            })
        if datos['proximas']:
            mensajes.append({
                'IDMENSAJE': 'deudas-proximas', 'TITULO': 'Mensualidades por vencer', 'CARGO': 'Deudas',
                'MENSAJE': f"{datos['proximas']} alumnas terminan su periodo en los próximos 7 días.",
                'PAGINA': 'deudas',
            })
    del_dia = cumpleanos({'seccion': 'hoy'})
    if del_dia:
        mensajes.append({
            'IDMENSAJE': 'cumpleanos-hoy', 'TITULO': 'Cumpleaños de hoy', 'CARGO': 'Cumpleaños',
            'MENSAJE': ', '.join(c['NOMBRE'] for c in del_dia[:6]) + ('…' if len(del_dia) > 6 else ''),
            'FECHAINICIO': hoy, 'PAGINA': 'cumpleanos',
        })
    return mensajes


def catalogos():
    with connection.cursor() as cursor:
        cursor.execute("SELECT IDCICLO, NOMBRE FROM CICLO WHERE ACTIVO = 1 ORDER BY NOMBRE")
        ciclos = [{'value': a, 'label': (b or '').upper()} for a, b in cursor.fetchall()]
        cursor.execute(
            "SELECT IDTURNO, NOMBRE, HORAINICIO, HORAFIN, DIASACTIVOS FROM TURNO WHERE ACTIVO = 1 ORDER BY HORAINICIO, NOMBRE"
        )
        turnos = [
            {'value': a, 'label': f'{b} ({c} - {d})', 'dias': e or ''}
            for a, b, c, d, e in cursor.fetchall()
        ]
        cursor.execute(
            """
            SELECT IDPROMOCION, NOMBRE, TIPO, MONTOREGULAR, MONTOPROMOCIONAL, MESESPROMOCION, MONTOSIGUIENTES
            FROM PROMOCION WHERE ACTIVO = 1 ORDER BY NOMBRE
            """
        )
        promociones = [
            {'value': a, 'label': f'{b} · S/ {float(e or 0):.2f}', 'tipo': c, 'regular': float(d or 0),
             'promocional': float(e or 0), 'meses': int(f or 1), 'siguientes': float(g) if g is not None else None}
            for a, b, c, d, e, f, g in cursor.fetchall()
        ]
        cursor.execute("SELECT IDTIPOUSUARIO, DESCRIPCION FROM TIPOUSUARIO ORDER BY IDTIPOUSUARIO")
        tipos = [{'value': a, 'label': b} for a, b in cursor.fetchall()]
    return {
        'ciclos': ciclos,
        'turnos': turnos,
        'promociones': promociones,
        'tiposUsuario': tipos,
        'funciones': [{'value': c, 'label': l} for c, l in FUNCIONES],
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
    'promociones': (listar_promociones, obtener_promocion, insertar_promocion, actualizar_promocion, eliminar_promocion),
    'auditoria': (listar_auditoria, obtener_auditoria, None, None, None),
}
