"""Pasa db.sqlite3 de voley 2.0 a VoleyDB (MySQL Workbench)."""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

import pymysql
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
SQLITE = Path(os.environ.get("SQLITE_PATH", r"C:\Users\Usuario\Downloads\db.sqlite3"))

DIAS = {0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado"}
GENEROS = {"female": "Mujer", "male": "Hombre"}
CONDICIONES = {"regular": "Regular", "becado": "Becado", "half_scholarship": "1/2 beca"}
MEDIOS = {
    "efectivo": "Efectivo", "transferencia": "Transferencia", "tarjeta": "Tarjeta",
    "yape": "Yape", "plin": "Plin", "otro": "Otro",
}
PRODUCTOS = {
    "camiseta_deportiva": "Camiseta deportiva", "falda_short": "Falda short", "short": "Short",
    "medias": "Medias", "rodilleras": "Rodilleras", "mangas": "Mangas", "poleras": "Poleras",
}
ASISTENCIA = {"present": "Presente", "absent": "Ausente", "late": "Tarde"}
MENSUALIDAD_ESTADO = {"debt": "Deuda", "completed": "Completada"}


def pid(prefijo: str, numero) -> str:
    return f"{prefijo}{int(numero):06d}"


def fecha(valor):
    if not valor:
        return None
    texto = str(valor)[:10]
    if len(texto) == 10 and texto[4] == "-":
        anio, mes, dia = texto.split("-")
        return f"{dia}{mes}{anio}"
    return None


def hora(valor):
    if not valor:
        return "00:00"
    return str(valor)[:5]


def dias(valor):
    if not valor:
        return "Todos"
    try:
        lista = json.loads(valor) if isinstance(valor, str) else list(valor)
    except Exception:
        return "Todos"
    if not lista or len(lista) >= 7:
        return "Todos"
    return ", ".join(DIAS[d] for d in lista if d in DIAS) or "Todos"


def medio(valor):
    if not valor:
        return "Efectivo"
    return MEDIOS.get(str(valor).lower(), str(valor))


def main() -> None:
    load_dotenv(ROOT / ".env")
    origen = sqlite3.connect(SQLITE)
    origen.row_factory = sqlite3.Row
    destino = pymysql.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "VoleyDB"),
        charset="utf8mb4",
        autocommit=False,
    )
    cur = destino.cursor()
    cur.execute("SET FOREIGN_KEY_CHECKS = 0")
    for tabla in (
        "AUDITORIA", "PAGO", "ASISTENCIA", "MENSUALIDAD", "VENTA", "EGRESO", "ALUMNA",
        "TURNO", "CICLO", "USUARIO_MODULO", "USUARIO_MODULO_EXCLUIDO",
        "USUARIO_SUBMODULO_EXCLUIDO", "USUARIO_SUBMODULO_INCLUIDO", "USUARIO",
    ):
        cur.execute(f"DELETE FROM {tabla}")

    for row in origen.execute("SELECT * FROM core_cycle"):
        cur.execute(
            "INSERT INTO CICLO (IDCICLO, NOMBRE, SLUG, ACTIVO, ORDEN, FECHACREACION) VALUES (%s,%s,%s,%s,%s,%s)",
            (pid("CIC", row["id"]), row["name"], row["slug"], 1 if row["is_active"] else 0, row["sort_order"] or 0, fecha(row["created_at"])),
        )
    for row in origen.execute("SELECT * FROM core_shift"):
        cur.execute(
            "INSERT INTO TURNO (IDTURNO, NOMBRE, HORAINICIO, HORAFIN, DIASACTIVOS, ACTIVO, FECHACREACION) VALUES (%s,%s,%s,%s,%s,1,%s)",
            (pid("TUR", row["id"]), row["name"], hora(row["start_time"]), hora(row["end_time"]), dias(row["active_days"]), fecha(row["created_at"])),
        )

    alumnas = 0
    for row in origen.execute("SELECT * FROM core_student"):
        if row["retired"]:
            estado = "Retirada"
        elif row["enrollment_status"] == "inactive":
            estado = "Inactiva"
        else:
            estado = "Activa"
        cur.execute(
            """
            INSERT INTO ALUMNA (
                IDALUMNA, NOMBRE, EDAD, DNI, EMAIL, TELEFONO, GENERO, IDCICLO, CONDICION, COLEGIO, TALLA,
                SUFREDE, COMOENTERO, UNIFORMEENTREGADO, APODERADO, DNIAPODERADO, FECHANACAPODERADO,
                GENEROAPODERADO, TELAPODERADO, DIRECCION, IDTURNO, ESTADO, MOTIVORETIRO, FECHARETIRO,
                MENSUALIDAD, FECHAINSCRIPCION, INICIOMENSUALIDAD, FINMENSUALIDAD, FECHANACIMIENTO, FECHACREACION
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                pid("ALU", row["id"]), row["name"], row["age"], row["dni"] or None, row["email"] or None,
                row["contact"], GENEROS.get(row["gender"] or "", row["gender"]),
                pid("CIC", row["cycle_id"]) if row["cycle_id"] else None,
                CONDICIONES.get(row["student_condition"] or "", "Regular"), row["school"], row["size"],
                row["suffers_from"], row["referral_source"], 1 if row["uniform_delivered"] else 0,
                row["guardian"], row["guardian_dni"], fecha(row["guardian_birth_date"]),
                GENEROS.get(row["guardian_gender"] or "", row["guardian_gender"]), row["guardian_phone"],
                row["address"], pid("TUR", row["shift_id"]) if row["shift_id"] else None, estado,
                row["retired_reason"], fecha(row["retired_at"]), row["monthly_fee"],
                fecha(row["enrollment_date"]), fecha(row["membership_start"]), fecha(row["membership_end"]),
                fecha(row["birth_date"]), fecha(row["created_at"]),
            ),
        )
        alumnas += 1

    for row in origen.execute("SELECT * FROM core_membership"):
        cur.execute(
            """
            INSERT INTO MENSUALIDAD (IDMENSUALIDAD, IDALUMNA, FECHAINICIO, FECHAFIN, MONTO, ESTADO, IDRENOVADA, NOTAS, FECHACREACION)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                pid("MEN", row["id"]), pid("ALU", row["student_id"]), fecha(row["start_date"]), fecha(row["end_date"]),
                row["amount_due"] or 0, MENSUALIDAD_ESTADO.get(row["status"], "Deuda"),
                pid("MEN", row["renewed_from_id"]) if row["renewed_from_id"] else None,
                row["notes"], fecha(row["created_at"]),
            ),
        )
    for row in origen.execute("SELECT * FROM core_payment"):
        cur.execute(
            "INSERT INTO PAGO (IDPAGO, IDMENSUALIDAD, IDALUMNA, FECHA, MONTO, MEDIO, FECHACREACION) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (
                pid("PAG", row["id"]),
                pid("MEN", row["membership_id"]) if row["membership_id"] else None,
                pid("ALU", row["student_id"]), fecha(row["date"]), row["amount"], medio(row["method"]),
                fecha(row["created_at"]),
            ),
        )
    for row in origen.execute("SELECT * FROM core_attendance"):
        cur.execute(
            "INSERT INTO ASISTENCIA (IDASISTENCIA, IDALUMNA, FECHA, ESTADO, FECHACREACION) VALUES (%s,%s,%s,%s,%s)",
            (
                pid("ASI", row["id"]), pid("ALU", row["student_id"]), fecha(row["date"]),
                ASISTENCIA.get(row["status"], "Presente"), fecha(row["created_at"]),
            ),
        )
    for row in origen.execute("SELECT * FROM core_sale"):
        cur.execute(
            """
            INSERT INTO VENTA (IDVENTA, NOMBRE, PRODUCTO, IDTURNO, TALLA, OBSERVACION, PRECIO, MEDIO, FECHA)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                pid("VEN", row["id"]), row["name"], PRODUCTOS.get(row["product"] or "", row["product"]),
                pid("TUR", row["shift_id"]), row["size"], row["observation"], row["price"] or 0,
                medio(row["payment_method"]), fecha(row["created_at"]),
            ),
        )
    for row in origen.execute("SELECT * FROM core_expense"):
        cur.execute(
            """
            INSERT INTO EGRESO (IDEGRESO, FECHA, CONCEPTO, PROVEEDOR, MONTO, MEDIO, OBSERVACIONES, FECHACREACION)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                pid("EGR", row["id"]), fecha(row["date"]), row["concept"], row["provider"] or None,
                row["amount"], medio(row["payment_method"]), row["observations"] or None, fecha(row["created_at"]),
            ),
        )

    perfiles = {r["user_id"]: r["role"] for r in origen.execute("SELECT user_id, role FROM core_userprofile")}
    for row in origen.execute("SELECT * FROM auth_user"):
        rol = perfiles.get(row["id"], "secretary")
        tipo = "3" if row["is_superuser"] or rol == "admin" else "1"
        nombre = (row["first_name"] or row["username"] or "Usuario")[:100]
        apellido = (row["last_name"] or "-")[:100]
        cur.execute(
            """
            INSERT INTO USUARIO (IDUSUARIO, CONTRA, NOMBRE, APELLIDO, DNI, EMAIL, ESTADO, IDTIPOUSUARIO)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                row["username"], row["password"], nombre, apellido, "00000000",
                row["email"] or None, "Activo" if row["is_active"] else "Retirado", tipo,
            ),
        )
    cur.execute(
        """
        INSERT INTO USUARIO (IDUSUARIO, CONTRA, NOMBRE, APELLIDO, DNI, EMAIL, ESTADO, IDTIPOUSUARIO)
        SELECT 'vita', 'vita', 'VITA', 'VOLEY', '00000000', 'vita@voley.local', 'Activo', '3'
        WHERE NOT EXISTS (SELECT 1 FROM USUARIO WHERE IDUSUARIO = 'vita')
        """
    )
    cur.execute("SET FOREIGN_KEY_CHECKS = 1")
    destino.commit()
    print(f"Alumnas migradas: {alumnas}")
    for tabla in ("CICLO", "TURNO", "ALUMNA", "MENSUALIDAD", "PAGO", "ASISTENCIA", "VENTA", "EGRESO", "USUARIO"):
        cur.execute(f"SELECT COUNT(*) FROM {tabla}")
        print(f"  {tabla}: {cur.fetchone()[0]}")
    destino.close()
    origen.close()


if __name__ == "__main__":
    main()
