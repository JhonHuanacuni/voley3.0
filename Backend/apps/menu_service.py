"""Menú lateral según módulos efectivos del usuario."""

from django.db import connection

from apps.models import (
    GrupoModulo,
    GrupoSubmoduloExcluido,
    Modulo,
    Submodulo,
    UsuarioModulo,
    UsuarioModuloExcluido,
    UsuarioSubmoduloExcluido,
    UsuarioSubmoduloIncluido,
)
from apps.menu_config import (
    MODULO_PAGE_MAP,
    MODULOS_MENU_DIRECTO,
    MODULOS_PROTEGIDOS_ADMIN,
    SUBMODULO_PAGE_MAP,
)


def get_usuario_tipo(idusuario: str):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT IDTIPOUSUARIO FROM USUARIO WHERE IDUSUARIO = %s AND ESTADO = 'Activo'",
            [idusuario],
        )
        row = cursor.fetchone()
    return str(row[0]) if row else None


def _permisos_agregados_por_modulo(idusuario, id_tipo):
    permisos = {}
    grupo_rows = GrupoModulo.objects.filter(IDTIPOUSUARIO=id_tipo).values(
        'IDMODULO_id', 'IDTIPOPERMISO__DESCRIPCION',
    )
    for row in grupo_rows:
        perm = row['IDTIPOPERMISO__DESCRIPCION']
        if not perm:
            continue
        mid = row['IDMODULO_id']
        permisos.setdefault(mid, [])
        if perm not in permisos[mid]:
            permisos[mid].append(perm)

    for row in UsuarioModulo.objects.filter(IDUSUARIO=idusuario).values(
        'IDMODULO_id', 'IDTIPOPERMISO__DESCRIPCION',
    ):
        perm = row['IDTIPOPERMISO__DESCRIPCION']
        if not perm:
            continue
        mid = row['IDMODULO_id']
        permisos.setdefault(mid, [])
        if perm not in permisos[mid]:
            permisos[mid].append(perm)

    excluidos = set(
        UsuarioModuloExcluido.objects.filter(IDUSUARIO=idusuario).values_list('IDMODULO_id', flat=True)
    )
    for mid in excluidos:
        if id_tipo == '3' and mid in MODULOS_PROTEGIDOS_ADMIN:
            continue
        permisos.pop(mid, None)

    if id_tipo == '3':
        for mid in MODULOS_PROTEGIDOS_ADMIN:
            permisos.setdefault(mid, ['VER', 'CREAR', 'EDITAR', 'ELIMINAR'])
    return permisos


def _submodulos_ocultos(idusuario, id_tipo):
    ocultos = set(
        UsuarioSubmoduloExcluido.objects.filter(IDUSUARIO=idusuario).values_list('IDSUBMODULO_id', flat=True)
    )
    rol = set(
        GrupoSubmoduloExcluido.objects.filter(IDTIPOUSUARIO=id_tipo or '').values_list('IDSUBMODULO_id', flat=True)
    )
    incluidos = set(
        UsuarioSubmoduloIncluido.objects.filter(IDUSUARIO=idusuario).values_list('IDSUBMODULO_id', flat=True)
    )
    return ocultos | (rol - incluidos)


def get_menu_for_user(idusuario: str):
    id_tipo = get_usuario_tipo(idusuario)
    if not id_tipo:
        return []
    permisos_por_modulo = _permisos_agregados_por_modulo(idusuario, id_tipo)
    if not permisos_por_modulo:
        return []

    modulos = Modulo.objects.filter(IDMODULO__in=permisos_por_modulo.keys(), ACTIVO=True).order_by('ORDEN')
    ocultos = _submodulos_ocultos(idusuario, id_tipo)
    menu = []
    for modulo in modulos:
        page = MODULO_PAGE_MAP.get(modulo.IDMODULO, modulo.IDMODULO.lower())
        permisos = permisos_por_modulo.get(modulo.IDMODULO, [])
        subs = Submodulo.objects.filter(IDMODULO=modulo, ACTIVO=True).order_by('ORDEN')
        if modulo.IDMODULO in MODULOS_MENU_DIRECTO or not subs.exists():
            menu.append({
                'idmodulo': modulo.IDMODULO,
                'nombre': modulo.NOMBRE,
                'icono': modulo.ICONO or 'faCircle',
                'page': page,
                'permisos': permisos,
                'type': 'link',
            })
            continue
        submodulos = [
            {
                'idsubmodulo': sub.IDSUBMODULO,
                'nombre': sub.NOMBRE,
                'icono': sub.ICONO or 'faCircle',
                'page': SUBMODULO_PAGE_MAP.get(sub.IDSUBMODULO, page),
            }
            for sub in subs
            if sub.IDSUBMODULO not in ocultos
        ]
        if not submodulos:
            continue
        menu.append({
            'idmodulo': modulo.IDMODULO,
            'nombre': modulo.NOMBRE,
            'icono': modulo.ICONO or 'faCircle',
            'page': page,
            'permisos': permisos,
            'type': 'section',
            'section': page,
            'submodulos': submodulos,
        })
    return menu
