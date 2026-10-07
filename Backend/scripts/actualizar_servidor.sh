#!/usr/bin/env bash
# Publica los cambios del backend que ya están en GitHub. Uso:
#   ~/vitavoley_src/Backend/scripts/actualizar_servidor.sh
#   ~/vitavoley_src/Backend/scripts/actualizar_servidor.sh 13_nuevo.sql   # además aplica esos .sql
#
# No ejecuta 01_esquema.sql: los datos se conservan.

set -euo pipefail

BACKEND="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND/.."

echo "Descargando cambios ..."
git pull --ff-only origin main

cd "$BACKEND"
venv/bin/pip install -q -r requirements.txt

if [[ $# -gt 0 ]]; then
  echo "Aplicando scripts SQL: $*"
  venv/bin/python scripts/run_mysql_scripts.py "$@"
fi

venv/bin/python manage.py collectstatic --noinput

sudo systemctl restart gunicorn-vitavoley
sleep 2
sudo systemctl is-active gunicorn-vitavoley
curl -s -o /dev/null -w "API: HTTP %{http_code}\n" http://127.0.0.1:8006/api/schema/
