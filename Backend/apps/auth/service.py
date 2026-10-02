from django.contrib.auth.hashers import check_password
from django.db import connection

from core import sp_runner as sp
from apps.menu_config import ROLE_FROM_TIPO


def _clave_valida(almacenada, ingresada):
    if not almacenada or ingresada is None:
        return False
    guardada = str(almacenada)
    if guardada.startswith(('pbkdf2_', 'argon2', 'bcrypt', 'scrypt')):
        return check_password(ingresada, guardada)
    return guardada == ingresada


def validar_usuario(username, password):
    with connection.cursor() as cursor:
        filas = sp.call_simple(cursor, 'usp_login_obtener', [username])
    if not filas:
        return False, None, None
    fila = filas[0]
    if str(fila.get('ESTADO') or '').upper() != 'ACTIVO':
        return False, None, None
    if not _clave_valida(fila.get('CONTRA'), password):
        return False, None, None
    tipo = str(fila.get('IDTIPOUSUARIO') or '')
    return True, ROLE_FROM_TIPO.get(tipo, 'secretaria'), tipo
