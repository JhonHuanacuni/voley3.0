"""Acceso a módulos y submódulos del menú por rol o por usuario."""

from django.db import connection

from core import sp_runner as sp
from core.rows import jsonable


def _objetivo(datos):
    """(id de rol, id de usuario) según lo que se esté editando; el usuario manda si viene."""
    idusuario = str(datos.get('idusuario') or '').strip() or None
    idtipo = None if idusuario else (str(datos.get('idtipousuario') or '').strip() or None)
    return idtipo, idusuario


def _filas(proc, params):
    with connection.cursor() as cursor:
        filas = jsonable(sp.call_simple(cursor, proc, params))
    for fila in filas:
        for clave in ('ASIGNADO', 'PROTEGIDO'):
            if clave in fila:
                fila[clave] = bool(fila[clave])
    return filas


def listar_roles():
    return _filas('usp_acceso_roles_listar', [])


def listar_usuarios():
    return _filas('usp_acceso_usuarios_listar', [])


def listar_modulos(datos):
    idtipo, idusuario = _objetivo(datos)
    if not idtipo and not idusuario:
        raise ValueError('Elige un rol o un usuario.')
    return _filas('usp_acceso_modulos', [idtipo, idusuario])


def listar_submodulos(datos):
    idtipo, idusuario = _objetivo(datos)
    idmodulo = str(datos.get('idmodulo') or '').strip()
    if (not idtipo and not idusuario) or not idmodulo:
        raise ValueError('Elige un rol o un usuario y un módulo.')
    return _filas('usp_acceso_submodulos', [idtipo, idusuario, idmodulo])


def _guardar(proc, datos, clave_id):
    idtipo, idusuario = _objetivo(datos)
    id_item = str(datos.get(clave_id) or '').strip()
    if (not idtipo and not idusuario) or not id_item:
        return 0, 'Faltan datos para guardar el acceso.'
    with connection.cursor() as cursor:
        return sp.call_write(cursor, proc, [idtipo, idusuario, id_item, 1 if datos.get('asignar') else 0])


def guardar_modulo(datos):
    return _guardar('usp_acceso_modulo_guardar', datos, 'idmodulo')


def guardar_submodulo(datos):
    return _guardar('usp_acceso_submodulo_guardar', datos, 'idsubmodulo')
