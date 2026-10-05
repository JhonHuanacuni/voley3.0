"""
Aplica los scripts de VoleyDB.

En MySQL Workbench, los archivos con DELIMITER se abren con
File > Open SQL Script y se ejecutan con el botón del rayo
(no con File > Run SQL Script).

Uso:
  cd Backend
  .venv\\Scripts\\python.exe scripts\\run_mysql_scripts.py
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

try:
    import pymysql
except ImportError:
    print("Falta PyMySQL. Ejecuta: pip install PyMySQL python-dotenv")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "db_scripts_mysql" / "30_09_2026"
ORDER = [
    SCRIPTS / "01_esquema.sql",
    SCRIPTS / "02_seed.sql",
    SCRIPTS / "03_usp_ciclo_turno_usuario.sql",
    SCRIPTS / "04_usp_alumna.sql",
    SCRIPTS / "05_usp_mensualidad_pago.sql",
    SCRIPTS / "06_usp_operacion.sql",
    SCRIPTS / "07_esquema_requerimientos.sql",
    SCRIPTS / "08_usp_requerimientos.sql",
    SCRIPTS / "09_ventas_abonos.sql",
    SCRIPTS / "10_auditoria.sql",
    SCRIPTS / "11_usp_reportes_detalle.sql",
    SCRIPTS / "12_usp_accesos.sql",
]


def split_sql(content: str) -> list[str]:
    statements: list[str] = []
    delimiter = ";"
    buf: list[str] = []
    for raw_line in content.splitlines():
        line = raw_line.rstrip("\r")
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        match = re.match(r"^DELIMITER\s+(.+)$", stripped, re.IGNORECASE)
        if match:
            chunk = "\n".join(buf).strip()
            if chunk:
                statements.append(chunk)
            buf = []
            delimiter = match.group(1).strip()
            continue
        buf.append(line)
        joined = "\n".join(buf)
        if joined.rstrip().endswith(delimiter):
            stmt = joined.rstrip()[: -len(delimiter)].strip()
            if stmt:
                statements.append(stmt)
            buf = []
    tail = "\n".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


def main() -> int:
    load_dotenv(ROOT / ".env")
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = int(os.getenv("DB_PORT", "3306"))
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "")
    print(f"Conectando a {user}@{host}:{port} ...")
    conn = pymysql.connect(host=host, port=port, user=user, password=password, charset="utf8mb4", collation="utf8mb4_unicode_ci", autocommit=True)
    try:
        with conn.cursor() as cur:
            for path in ORDER:
                print(f"\n=== {path.name} ===")
                for i, stmt in enumerate(split_sql(path.read_text(encoding="utf-8")), 1):
                    preview = " ".join(stmt.split())[:100]
                    try:
                        cur.execute(stmt)
                        while cur.nextset():
                            pass
                        print(f"  OK [{i}] {preview}")
                    except Exception as exc:
                        print(f"  ERROR [{i}] {preview}")
                        print(f"         {exc}")
                        return 1
    finally:
        conn.close()
    print("\nScripts aplicados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
