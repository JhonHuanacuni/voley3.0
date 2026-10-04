import json
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.auth.service import registrar_acceso, validar_usuario
from apps.menu_service import get_menu_for_user
from apps.permisos import funciones_usuario

logger = logging.getLogger(__name__)


def _auditar_acceso(username, accion, detalle, exitoso):
    try:
        registrar_acceso(username, accion, detalle, exitoso)
    except Exception:
        logger.exception('No se pudo registrar el acceso de %s en AUDITORIA', username)


@csrf_exempt
def login(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({'error': 'JSON inválido'}, status=400)
    username = (payload.get('username') or '').strip()
    password = payload.get('password') or ''
    if not username or not password:
        return JsonResponse({'error': 'Usuario y contraseña son requeridos'}, status=400)
    try:
        valido, rol, tipo = validar_usuario(username, password)
    except Exception as exc:
        return JsonResponse({'error': str(exc)}, status=500)
    if valido:
        _auditar_acceso(username, 'Inicio de sesión', 'Ingreso al sistema', True)
    else:
        _auditar_acceso(username, 'Acceso denegado', 'Usuario o contraseña incorrectos, o usuario inactivo', False)
    return JsonResponse({
        'valid': valido,
        'role': rol,
        'idusuario': username if valido else None,
        'idtipousuario': tipo,
        'funciones': funciones_usuario(username) if valido else [],
    })


@csrf_exempt
def logout(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    usuario = (request.headers.get('X-IdUsuario') or '').strip()
    if usuario:
        _auditar_acceso(usuario, 'Cierre de sesión', 'Salida del sistema', True)
    return JsonResponse({'ok': True})


def menu_usuario(request):
    idusuario = (request.GET.get('idusuario') or '').strip()
    if not idusuario:
        return JsonResponse({'success': False, 'error': 'Falta el usuario'}, status=400)
    try:
        return JsonResponse({
            'success': True,
            'menu': get_menu_for_user(idusuario),
            'funciones': funciones_usuario(idusuario),
        })
    except Exception as exc:
        return JsonResponse({'success': False, 'error': str(exc)}, status=500)
