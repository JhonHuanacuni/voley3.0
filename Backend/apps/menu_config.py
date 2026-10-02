MODULOS_MENU_DIRECTO = frozenset({'MOD001'})

MODULOS_PROTEGIDOS_ADMIN = frozenset({'MOD001', 'MOD002', 'MOD003'})

MODULO_PAGE_MAP = {
    'MOD001': 'dashboard',
    'MOD002': 'academia',
    'MOD003': 'administracion',
}

SUBMODULO_PAGE_MAP = {
    'SUB001': 'alumnas',
    'SUB002': 'asistencia',
    'SUB003': 'mensualidades',
    'SUB004': 'pagos',
    'SUB005': 'retiradas',
    'SUB006': 'ciclos',
    'SUB007': 'turnos',
    'SUB008': 'ventas',
    'SUB009': 'egresos',
    'SUB010': 'usuarios',
    'SUB011': 'auditoria',
    'SUB012': 'cumpleanos',
    'SUB013': 'deudas',
    'SUB014': 'reportes',
    'SUB015': 'promociones',
}

ROLE_FROM_TIPO = {
    '1': 'secretaria',
    '3': 'administrador',
}
