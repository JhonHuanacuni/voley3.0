from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.academia.controller import _body, _exigir, _params
from apps.accesos.service import (
    guardar_modulo,
    guardar_submodulo,
    listar_modulos,
    listar_roles,
    listar_submodulos,
    listar_usuarios,
)

FUNCION_ACCESOS = 'GESTIONAR_USUARIOS'


def _lista(request, listar):
    if request.method != 'GET':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    denegado = _exigir(request, FUNCION_ACCESOS)
    if denegado:
        return denegado
    try:
        return JsonResponse({'data': listar()})
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


def _lista_y_guardado(request, listar, guardar):
    if request.method == 'GET':
        return _lista(request, lambda: listar(_params(request)))
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    payload = _body(request)
    if payload is None:
        return JsonResponse({'error': 'JSON inválido'}, status=400)
    denegado = _exigir(request, FUNCION_ACCESOS)
    if denegado:
        return denegado
    try:
        ok, mensaje = guardar(payload)
        return JsonResponse({'ok': bool(ok), 'mensaje': mensaje}, status=200 if ok else 400)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)


def roles_view(request):
    return _lista(request, listar_roles)


def usuarios_view(request):
    return _lista(request, listar_usuarios)


@csrf_exempt
def modulos_view(request):
    return _lista_y_guardado(request, listar_modulos, guardar_modulo)


@csrf_exempt
def submodulos_view(request):
    return _lista_y_guardado(request, listar_submodulos, guardar_submodulo)
