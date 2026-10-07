#!/usr/bin/env bash
# Primera instalación de VITA VOLEY en Linode. Uso:
#   cd ~/vitavoley_src/Backend
#   chmod +x scripts/bootstrap_server.sh
#   ./scripts/bootstrap_server.sh             # crea VoleyDB solo si aún no existe
#   ./scripts/bootstrap_server.sh --reset-db  # BORRA VoleyDB y la vuelve a crear

set -euo pipefail

BACKEND="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND"

RESET_DB=0
[[ "${1:-}" == "--reset-db" ]] && RESET_DB=1

if [[ ! -f .env ]]; then
  echo "ERROR: Crea Backend/.env (copia deploy/env.production.example)" >&2
  exit 1
fi

if grep -q "PON_AQUI_LA_MISMA_CLAVE_MYSQL\|cambia-esto-por-un-secret-key" .env; then
  echo "ERROR: Completa DB_PASSWORD y SECRET_KEY en Backend/.env" >&2
  exit 1
fi

if ! dpkg -s python3.12-venv >/dev/null 2>&1; then
  echo "Instalando python3.12-venv ..."
  sudo apt-get update -qq
  sudo apt-get install -y python3.12-venv
fi

if [[ ! -x venv/bin/python ]]; then
  echo "Creando venv ..."
  python3 -m venv venv
fi

echo "Instalando dependencias ..."
venv/bin/pip install -q --upgrade pip
venv/bin/pip install -q -r requirements.txt

echo "Permiso para triggers y funciones MySQL ..."
sudo mysql -e "SET GLOBAL log_bin_trust_function_creators = 1;" 2>/dev/null || true

EXISTE=$(venv/bin/python - <<'PY'
import os
import pymysql
from dotenv import load_dotenv

load_dotenv('.env')
conn = pymysql.connect(
    host=os.getenv('DB_HOST', '127.0.0.1'), port=int(os.getenv('DB_PORT', '3306')),
    user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD', ''),
)
with conn.cursor() as cur:
    cur.execute(
        "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'USUARIO'",
        (os.getenv('DB_NAME', 'VoleyDB'),),
    )
    print(cur.fetchone()[0])
conn.close()
PY
)

if [[ "$EXISTE" == "0" || "$RESET_DB" == "1" ]]; then
  echo "Creando VoleyDB (esquema, datos base y procedimientos) ..."
  venv/bin/python scripts/run_mysql_scripts.py
else
  echo "VoleyDB ya existe: no se toca. Usa --reset-db para recrearla."
fi

echo "Estáticos Django ..."
venv/bin/python manage.py collectstatic --noinput

mkdir -p media

echo ""
echo "OK. Siguiente: instalar gunicorn-vitavoley.service (ver deploy/PASOS_COPIAR.txt)"
