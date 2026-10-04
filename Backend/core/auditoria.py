"""Contexto de auditoría: cada petición deja en la sesión MySQL quién, desde dónde y con qué procedimiento opera.

Los triggers de AUDITORIA leen @app_usuario, @app_modulo, @app_procedimiento, @app_metodo, @app_ruta,
@app_ip, @app_navegador y @app_solicitud (ver db_scripts_mysql/30_09_2026/10_auditoria.sql).
"""

import re
import uuid

from django.db import connection

_CALL = re.compile(r'^\s*CALL\s+`?(\w+)`?', re.IGNORECASE)


def _ip(request):
    reenviada = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if reenviada:
        return reenviada.split(',')[0].strip()[:45]
    return (request.META.get('REMOTE_ADDR') or '')[:45]


def contexto_peticion(request):
    return {
        'usuario': (request.headers.get('X-IdUsuario') or request.GET.get('idusuario') or '').strip()[:50] or None,
        'modulo': (request.headers.get('X-Modulo') or '').strip()[:60] or None,
        'metodo': request.method[:10],
        'ruta': request.path[:255],
        'ip': _ip(request) or None,
        'navegador': (request.META.get('HTTP_USER_AGENT') or '')[:255] or None,
        'solicitud': str(uuid.uuid4()),
    }


class _ContextoSesion:
    """execute_wrapper: fija las variables de sesión antes de la primera consulta y el nombre de cada CALL."""

    def __init__(self, contexto):
        self.contexto = contexto
        self.conexion = None
        self.procedimiento = None

    def __call__(self, execute, sql, params, many, context):
        bd = context['connection'].connection
        if bd is not self.conexion:
            self.conexion = bd
            self.procedimiento = None
            c = self.contexto
            execute(
                'SET @app_usuario = %s, @app_modulo = %s, @app_metodo = %s, @app_ruta = %s, '
                '@app_ip = %s, @app_navegador = %s, @app_solicitud = %s, @app_procedimiento = NULL',
                [c['usuario'], c['modulo'], c['metodo'], c['ruta'], c['ip'], c['navegador'], c['solicitud']],
                False, context,
            )
        llamada = _CALL.match(sql) if isinstance(sql, str) else None
        if llamada and llamada.group(1) != self.procedimiento and not llamada.group(1).lower().startswith('usp_auditoria_'):
            self.procedimiento = llamada.group(1)
            execute('SET @app_procedimiento = %s', [self.procedimiento[:100]], False, context)
        return execute(sql, params, many, context)


class AuditoriaMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if connection.vendor != 'mysql' or not request.path.startswith('/api/'):
            return self.get_response(request)
        with connection.execute_wrapper(_ContextoSesion(contexto_peticion(request))):
            return self.get_response(request)
