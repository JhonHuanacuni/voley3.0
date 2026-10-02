"""CRUD de negocio vía stored procedures de VoleyDB."""

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
    if not campo:
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


def insertar_turno(payload):
    return _escribir('usp_turno_insertar', _turno_valores(payload))


def actualizar_turno(id_registro, payload):
    return _escribir('usp_turno_actualizar', [id_registro, *_turno_valores(payload)])


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
        valores.append(texto(payload.get('IDUSUARIO'), 50))
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


def listar_mensualidades(params):
    return _listar('usp_mensualidad_listar', _paginacion(params, extras=[
        *_rango(params),
        params.get('idciclo') or None,
        params.get('situacion') or None,
        params.get('tipo') or None,
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
    return _escribir('usp_mensualidad_insertar', _mensualidad_valores(payload))


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


def _saltos(numeros, prefijo):
    valores = []
    for numero in numeros:
        texto_num = str(numero or '')
        if not texto_num.startswith(prefijo):
            continue
        try:
            valores.append(int(texto_num[len(prefijo):]))
        except ValueError:
            continue
    if not valores:
        return []
    presentes = set(valores)
    return [f'{prefijo}{i:06d}' for i in range(1, max(valores) + 1) if i not in presentes]


def control_recibos():
    with connection.cursor() as cursor:
        filas = sp.call_simple(cursor, 'usp_venta_recibos', [])
    filas = jsonable(filas)
    return {
        'anulados': [f for f in filas if f.get('ESTADO_RECIBO') == 'Anulado'],
        'eliminados': [f for f in filas if f.get('ESTADO_RECIBO') == 'Eliminado'],
        'saltos': _saltos((f.get('IDVENTA') for f in filas), 'VEN') + _saltos((f.get('COMPROBANTE') for f in filas), 'CMP'),
    }


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
    return _listar('usp_auditoria_listar', _paginacion(params, extras=_rango(params)))


def asistencia_dia(fecha, id_turno):
    with connection.cursor() as cursor:
        rows = sp.call_simple(cursor, 'usp_asistencia_dia', [fecha, id_turno or None])
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
        turnos = sp.call_simple(cursor, 'usp_dashboard_turnos', [])
    return {
        'resumen': jsonable(resumen[0] if resumen else {}),
        'turnos': jsonable(turnos),
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
        texto(payload.get('CONDICIONES'), 500, mayusculas=False),
        texto(payload.get('ACTIVO'), 20, mayusculas=False),
    ]


def insertar_promocion(payload):
    return _escribir('usp_promocion_insertar', _promocion_valores(payload))


def actualizar_promocion(id_registro, payload):
    return _escribir('usp_promocion_actualizar', [id_registro, *_promocion_valores(payload)])


def eliminar_promocion(id_registro):
    return _escribir('usp_promocion_eliminar', [id_registro])


def _fecha_db(valor):
    """CHAR(8) DDMMYYYY a date, o None."""
    s = str(valor or '').strip()
    if len(s) != 8 or not s.isdigit():
        return None
    try:
        return date(int(s[4:]), int(s[2:4]), int(s[:2]))
    except ValueError:
        return None


def _proximo_cumple(nacimiento, hoy):
    try:
        cumple = nacimiento.replace(year=hoy.year)
    except ValueError:
        cumple = date(hoy.year, 3, 1)
    if cumple < hoy:
        try:
            cumple = nacimiento.replace(year=hoy.year + 1)
        except ValueError:
            cumple = date(hoy.year + 1, 3, 1)
    return cumple


def cumpleanos(params):
    hoy = date.today()
    with connection.cursor() as cursor:
        filas = jsonable(sp.call_simple(cursor, 'usp_cumpleanos_listar', [params.get('idciclo') or None]))
    datos = []
    for fila in filas:
        nacimiento = _fecha_db(fila.get('FECHANACIMIENTO'))
        if not nacimiento:
            continue
        proximo = _proximo_cumple(nacimiento, hoy)
        fila['DIA'] = nacimiento.day
        fila['MES'] = nacimiento.month
        fila['CUMPLE'] = proximo.year - nacimiento.year
        fila['FALTAN'] = (proximo - hoy).days
        datos.append(fila)
    return {'hoy': hoy.strftime('%d%m%Y'), 'data': datos}


def buscar_general(texto_buscar):
    with connection.cursor() as cursor:
        return jsonable(sp.call_simple(cursor, 'usp_alumna_buscar_general', [str(texto_buscar or '').strip()[:100]]))


def estado_cuenta(id_alumna):
    with connection.cursor() as cursor:
        sets = jsonable(sp.call_sets(cursor, 'usp_estado_cuenta', [id_alumna]))
    while len(sets) < 7:
        sets.append([])
    alumna, mensualidades, pagos, ventas, productos, historial, abonos = sets[:7]
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
        'historial': historial,
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


def deudas(params):
    try:
        dias = max(1, min(int(params.get('dias') or 7), 60))
    except (TypeError, ValueError):
        dias = 7
    with connection.cursor() as cursor:
        sets = jsonable(sp.call_sets(cursor, 'usp_deudas', [dias]))
    while len(sets) < 3:
        sets.append([])
    mensualidades, proximas, ventas = sets[:3]

    por_alumna = {}

    def _grupo(clave, nombre, ciclo, telefono):
        if clave not in por_alumna:
            por_alumna[clave] = {
                'IDALUMNA': clave if not clave.startswith('NOMBRE:') else None,
                'ALUMNA': nombre, 'CICLO': ciclo, 'TELAPODERADO': telefono,
                'VENCIDAS': 0, 'MENSUALIDADES': 0.0, 'PRODUCTOS': 0.0, 'SERVICIOS': 0.0, 'TOTAL': 0.0,
            }
        return por_alumna[clave]

    for m in mensualidades:
        g = _grupo(m['IDALUMNA'], m.get('ALUMNA'), m.get('CICLO'), m.get('TELAPODERADO'))
        g['MENSUALIDADES'] += m.get('SALDO') or 0
        if m.get('SITUACION') == 'Vencida':
            g['VENCIDAS'] += 1
    for v in ventas:
        clave = v.get('IDALUMNA') or f"NOMBRE:{v.get('ALUMNA')}"
        g = _grupo(clave, v.get('ALUMNA'), v.get('CICLO'), None)
        g['SERVICIOS' if v.get('TIPO') == 'Servicio' else 'PRODUCTOS'] += v.get('SALDO') or 0
    for g in por_alumna.values():
        g['TOTAL'] = round(g['MENSUALIDADES'] + g['PRODUCTOS'] + g['SERVICIOS'], 2)
    alumnas = sorted(por_alumna.values(), key=lambda g: (-g['TOTAL'], g['ALUMNA'] or ''))

    vencidas = [m for m in mensualidades if m.get('SITUACION') == 'Vencida']
    total_men = sum(m.get('SALDO') or 0 for m in mensualidades)
    total_prod = sum(v.get('SALDO') or 0 for v in ventas if v.get('TIPO') != 'Servicio')
    total_serv = sum(v.get('SALDO') or 0 for v in ventas if v.get('TIPO') == 'Servicio')
    return {
        'dias': dias,
        'mensualidades': mensualidades,
        'proximas': proximas,
        'ventas': ventas,
        'alumnas': alumnas,
        'totales': {
            'vencidas': len(vencidas),
            'montoVencido': round(sum(m.get('SALDO') or 0 for m in vencidas), 2),
            'proximas': len(proximas),
            'mensualidades': round(total_men, 2),
            'productos': round(total_prod, 2),
            'servicios': round(total_serv, 2),
            'porCobrar': round(total_men + total_prod + total_serv, 2),
            'alumnas': len(alumnas),
        },
    }


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
        filas = jsonable(sp.call_simple(cursor, 'usp_reporte', [
            tipo,
            _fecha_param(params.get('desde')),
            _fecha_param(params.get('hasta')),
            params.get('idciclo') or None,
        ]))
    sumables = [f for f in filas if f.get('ESTADO') == 'Emitido'] if tipo == 'ventas' else filas
    totales = {}
    for clave, _, formato in columnas:
        if tipo == 'abonos' and clave == 'SALDO':
            continue
        if formato == _M or (formato == _E and clave in ('CANTIDAD', 'PRESENTES', 'FALTAS', 'REGISTROS')):
            totales[clave] = round(sum(f.get(clave) or 0 for f in sumables), 2)
    return {
        'tipo': tipo,
        'titulo': titulo,
        'columnas': [{'key': k, 'label': l, 'formato': f} for k, l, f in columnas],
        'filas': filas,
        'totales': totales,
    }


def avisos(funciones):
    mensajes = []
    hoy = date.today().strftime('%d%m%Y')
    if 'VER_SALDOS' in funciones:
        datos = deudas({'dias': 7})['totales']
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
    del_dia = [c for c in cumpleanos({})['data'] if c['FALTAN'] == 0]
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
        ciclos = [{'value': a, 'label': b} for a, b in cursor.fetchall()]
        cursor.execute(
            "SELECT IDTURNO, NOMBRE, HORAINICIO, HORAFIN FROM TURNO WHERE ACTIVO = 1 ORDER BY HORAINICIO, NOMBRE"
        )
        turnos = [
            {'value': a, 'label': f'{b} ({c} - {d})'}
            for a, b, c, d in cursor.fetchall()
        ]
        cursor.execute(
            """
            SELECT IDALUMNA, NOMBRE, IFNULL(DNI, ''), IFNULL(EMAIL, ''), IFNULL(TELEFONO, '')
            FROM ALUMNA WHERE ESTADO <> 'Retirada' ORDER BY NOMBRE
            """
        )
        alumnas = [
            {'value': a, 'label': b, 'dni': c, 'email': d, 'telefono': e}
            for a, b, c, d, e in cursor.fetchall()
        ]
        cursor.execute(
            """
            SELECT m.IDMENSUALIDAD, a.IDALUMNA, a.NOMBRE, m.FECHAINICIO, m.FECHAFIN, m.ESTADO, m.MONTO,
                   GREATEST(m.MONTO - IFNULL(pg.PAGADO, 0), 0) AS SALDO
            FROM MENSUALIDAD m
            INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
            LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
                   ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
            WHERE m.ESTADO <> 'Inactivo'
            ORDER BY STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') DESC
            """
        )
        mensualidades = [
            {'value': a, 'idalumna': b, 'nombre': c, 'inicio': d, 'fin': e, 'estado': f,
             'monto': float(g or 0), 'saldo': float(h or 0)}
            for a, b, c, d, e, f, g, h in cursor.fetchall()
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
        'alumnas': alumnas,
        'mensualidades': mensualidades,
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
    'auditoria': (listar_auditoria, None, None, None, None),
}
