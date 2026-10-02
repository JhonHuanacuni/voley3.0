import json

from django.db import connection
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.academia.service import (
    OPERACIONES,
    abonos_venta,
    anular_abono,
    anular_venta,
    registrar_abono,
    asistencia_dia,
    avisos,
    buscar_general,
    catalogos,
    control_recibos,
    cumpleanos,
    dashboard,
    dashboard_matriculas,
    deudas,
    es_primera_mensualidad,
    estado_cuenta,
    listar_ordenado,
    marcar_asistencia,
    renovar_mensualidad,
    reporte,
    trazabilidad,
)
from apps.permisos import FUNCIONES, funciones_usuario

ETIQUETA_FUNCION = dict(FUNCIONES)

FUNCION_REGISTRAR = {
    'alumnas': 'REGISTRAR_ALUMNAS',
    'pagos': 'EMITIR_RECIBOS',
    'ventas': 'REGISTRAR_VENTAS',
    'usuarios': 'GESTIONAR_USUARIOS',
    'promociones': 'MODIFICAR_OPERACIONES',
}


def _actor(request):
    return (request.headers.get('X-IdUsuario') or request.GET.get('idusuario') or '').strip() or None


def _body(request):
    try:
        return json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        return None


def _params(request):
    return {k: request.GET.get(k) for k in request.GET}


def _marcar_actor(actor):
    with connection.cursor() as cursor:
        cursor.execute('SET @app_usuario = %s', [actor])


def _exigir(request, *codigos):
    """Devuelve una respuesta de error si el usuario no tiene ninguna de las funciones, o None si puede."""
    actor = _actor(request)
    if not actor:
        return JsonResponse({'ok': False, 'error': 'Inicia sesión para continuar.', 'mensaje': 'Inicia sesión para continuar.'}, status=401)
    propias = funciones_usuario(actor)
    if codigos and not any(c in propias for c in codigos):
        nombres = ' o '.join(ETIQUETA_FUNCION.get(c, c).lower() for c in codigos)
        mensaje = f'No tienes permiso para {nombres}.'
        return JsonResponse({'ok': False, 'error': mensaje, 'mensaje': mensaje}, status=403)
    _marcar_actor(actor)
    return None


def _funcion_escritura(nombre, metodo, payload=None):
    if nombre == 'usuarios':
        return ('GESTIONAR_USUARIOS',)
    if metodo == 'POST':
        if nombre == 'mensualidades':
            id_alumna = (payload or {}).get('IDALUMNA')
            if id_alumna and es_primera_mensualidad(id_alumna):
                return ('REGISTRAR_MATRICULAS',)
            return ('REGISTRAR_MENSUALIDADES',)
        codigo = FUNCION_REGISTRAR.get(nombre)
        return (codigo,) if codigo else ()
    if metodo == 'PUT':
        return ('MODIFICAR_OPERACIONES',)
    return ('ANULAR_OPERACIONES',)


@csrf_exempt
def entidad(request, nombre, id_registro=None):
    ops = OPERACIONES.get(nombre)
    if not ops:
        return JsonResponse({'error': 'Recurso no encontrado'}, status=404)
    listar, obtener, insertar, actualizar, eliminar = ops
    try:
        if request.method == 'GET' and not id_registro:
            data, total = listar_ordenado(listar, _params(request))
            return JsonResponse({
                'data': data,
                'total': total,
                'pagina': int(request.GET.get('pagina') or 1),
                'tamanioPagina': int(request.GET.get('tamanio') or 10),
            })
        if request.method == 'GET' and id_registro:
            if not obtener:
                return JsonResponse({'error': 'Método no permitido'}, status=405)
            row = obtener(id_registro)
            if not row:
                return JsonResponse({'error': 'Registro no encontrado'}, status=404)
            return JsonResponse({'data': row})
        if request.method == 'POST' and not id_registro and insertar:
            payload = _body(request)
            if payload is None:
                return JsonResponse({'error': 'JSON inválido'}, status=400)
            denegado = _exigir(request, *_funcion_escritura(nombre, 'POST', payload))
            if denegado:
                return denegado
            if nombre == 'ventas':
                payload['IDUSUARIO_ACCION'] = _actor(request)
            ok, mensaje = insertar(payload)
            return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
        if request.method == 'PUT' and id_registro and actualizar:
            payload = _body(request)
            if payload is None:
                return JsonResponse({'error': 'JSON inválido'}, status=400)
            denegado = _exigir(request, *_funcion_escritura(nombre, 'PUT'))
            if denegado:
                return denegado
            if nombre == 'ventas':
                payload['IDUSUARIO_ACCION'] = _actor(request)
            ok, mensaje = actualizar(id_registro, payload)
            return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
        if request.method == 'DELETE' and id_registro and eliminar:
            denegado = _exigir(request, *_funcion_escritura(nombre, 'DELETE'))
            if denegado:
                return denegado
            if nombre == 'ventas':
                ok, mensaje = eliminar(id_registro, _actor(request))
            else:
                ok, mensaje = eliminar(id_registro)
            return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)


@csrf_exempt
def ventas_control_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        return JsonResponse({'data': control_recibos()})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def venta_anular_view(request, id_registro):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    denegado = _exigir(request, 'ANULAR_OPERACIONES')
    if denegado:
        return denegado
    try:
        ok, mensaje = anular_venta(id_registro, _actor(request))
        return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def venta_abonos_view(request, id_registro):
    try:
        if request.method == 'GET':
            data = abonos_venta(id_registro)
            if not data:
                return JsonResponse({'error': 'Venta no encontrada'}, status=404)
            return JsonResponse({'data': data})
        if request.method == 'POST':
            payload = _body(request)
            if payload is None:
                return JsonResponse({'error': 'JSON inválido'}, status=400)
            denegado = _exigir(request, 'REGISTRAR_VENTAS', 'EMITIR_RECIBOS')
            if denegado:
                return denegado
            ok, mensaje = registrar_abono(id_registro, payload)
            return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)


@csrf_exempt
def abono_anular_view(request, id_abono):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    denegado = _exigir(request, 'ANULAR_OPERACIONES')
    if denegado:
        return denegado
    try:
        ok, mensaje = anular_abono(id_abono)
        return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def mensualidad_renovar_view(request, id_registro):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    denegado = _exigir(request, 'REGISTRAR_MENSUALIDADES')
    if denegado:
        return denegado
    try:
        ok, mensaje = renovar_mensualidad(id_registro)
        return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def mensajes_vigentes_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        return JsonResponse({'data': avisos(funciones_usuario(_actor(request)))})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def catalogos_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        return JsonResponse({'data': catalogos()})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def dashboard_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    denegado = _exigir(request, 'VER_DASHBOARD')
    if denegado:
        return denegado
    try:
        return JsonResponse({'data': dashboard()})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def dashboard_matriculas_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    denegado = _exigir(request, 'VER_DASHBOARD')
    if denegado:
        return denegado
    try:
        return JsonResponse({'data': dashboard_matriculas(request.GET)})
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def asistencia_dia_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    fecha = request.GET.get('fecha') or ''
    id_turno = request.GET.get('idturno') or None
    if len(fecha) != 8:
        return JsonResponse({'error': 'Indica la fecha.'}, status=400)
    try:
        return JsonResponse({'data': asistencia_dia(fecha, id_turno)})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def asistencia_marcar_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    payload = _body(request)
    if not payload:
        return JsonResponse({'error': 'JSON inválido'}, status=400)
    denegado = _exigir(request, 'GESTIONAR_ASISTENCIAS')
    if denegado:
        return denegado
    try:
        ok, mensaje = marcar_asistencia(payload)
        return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def cumpleanos_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        return JsonResponse({'data': cumpleanos(request.GET)})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def buscar_alumnas_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        return JsonResponse({'data': buscar_general(request.GET.get('q'))})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def estado_cuenta_view(request, id_alumna):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        data = estado_cuenta(id_alumna)
        if not data:
            return JsonResponse({'error': 'Alumna no encontrada'}, status=404)
        if 'VER_SALDOS' not in funciones_usuario(_actor(request)):
            data['ocultarSaldos'] = True
        return JsonResponse({'data': data})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def deudas_view(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    denegado = _exigir(request, 'VER_SALDOS')
    if denegado:
        return denegado
    try:
        return JsonResponse({'data': deudas(request.GET)})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def reporte_view(request, tipo):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    denegado = _exigir(request, 'VER_REPORTES')
    if denegado:
        return denegado
    try:
        return JsonResponse({'data': reporte(tipo, request.GET)})
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


@csrf_exempt
def trazabilidad_view(request, nombre, id_registro):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        return JsonResponse({'data': trazabilidad(nombre, id_registro)})
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)
