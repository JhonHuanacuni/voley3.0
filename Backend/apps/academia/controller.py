import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.academia.service import OPERACIONES, asistencia_dia, catalogos, dashboard, marcar_asistencia


def _body(request):
    try:
        return json.loads(request.body.decode('utf-8') or '{}')
    except Exception:
        return None


def _params(request):
    return {k: request.GET.get(k) for k in request.GET}


@csrf_exempt
def entidad(request, nombre, id_registro=None):
    ops = OPERACIONES.get(nombre)
    if not ops:
        return JsonResponse({'error': 'Recurso no encontrado'}, status=404)
    listar, obtener, insertar, actualizar, eliminar = ops
    try:
        if request.method == 'GET' and not id_registro:
            data, total = listar(_params(request))
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
        if request.method == 'POST' and not id_registro:
            payload = _body(request)
            if payload is None:
                return JsonResponse({'error': 'JSON inválido'}, status=400)
            ok, mensaje = insertar(payload)
            return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
        if request.method == 'PUT' and id_registro:
            payload = _body(request)
            if payload is None:
                return JsonResponse({'error': 'JSON inválido'}, status=400)
            ok, mensaje = actualizar(id_registro, payload)
            return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
        if request.method == 'DELETE' and id_registro:
            ok, mensaje = eliminar(id_registro)
            return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)
    return JsonResponse({'error': 'Método no permitido'}, status=405)


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
    try:
        return JsonResponse({'data': dashboard()})
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
    try:
        ok, mensaje = marcar_asistencia(payload)
        return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)
