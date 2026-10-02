from decimal import Decimal


def jsonable(valor):
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, dict):
        return {k: jsonable(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [jsonable(v) for v in valor]
    return valor


def texto(valor, maximo=None, mayusculas=True):
    if valor is None:
        return None
    limpio = str(valor).strip()
    if limpio == '':
        return None
    if mayusculas:
        limpio = limpio.upper()
    if maximo:
        return limpio[:maximo]
    return limpio


def entero(valor):
    limpio = texto(valor)
    if limpio is None:
        return None
    try:
        return int(float(limpio))
    except (TypeError, ValueError):
        return None


def bandera(valor):
    return 1 if str(valor).strip().upper() in ('1', 'SI', 'SÍ', 'TRUE', 'YES') else 0
