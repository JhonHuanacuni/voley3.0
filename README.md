# VITA VOLEY

Sistema de gestión de la academia VITA VOLEY: alumnas, asistencia, mensualidades, pagos y administración.

El frontend usa React y el diseño de la academia. El backend es Django y toda la persistencia pasa por procedimientos almacenados de MySQL (`VoleyDB`).

## Módulos

- **Dashboard.** Resumen de pagos, ventas, egresos y asistencia.
- **Academia.** Alumnas, asistencia, mensualidades, pagos y retiradas.
- **Administración.** Ciclos, turnos, ventas, egresos, usuarios y auditoría.

## Requisitos

- Python 3.11 o superior
- Node.js 20 o superior
- MySQL 8

## Puesta en marcha

### 1. Base de datos

Crea `Backend/.env` a partir del ejemplo y completa la contraseña de MySQL:

```bat
cd Backend
copy .env.example .env
```

```
DB_NAME=VoleyDB
DB_USER=root
DB_PASSWORD=tu_clave
DB_HOST=127.0.0.1
DB_PORT=3306
```

Los scripts están en `Backend/db_scripts_mysql/30_09_2026/`. `01_esquema.sql` borra y vuelve a crear `VoleyDB`. No lo ejecutes si la base ya tiene datos.

Orden:

1. `01_esquema.sql`
2. `02_seed.sql`
3. `03_usp_ciclo_turno_usuario.sql`
4. `04_usp_alumna.sql`
5. `05_usp_mensualidad_pago.sql`
6. `06_usp_operacion.sql`

Los archivos 03 a 06 usan `DELIMITER`. En MySQL Workbench ábrelos con **File > Open SQL Script** y ejecútalos con el rayo, con `VoleyDB` seleccionada.

O, desde `Backend`, con el entorno virtual ya creado:

```bat
.venv\Scripts\python.exe scripts\run_mysql_scripts.py
```

Para cargar los datos de voley 2.0 desde un SQLite:

```bat
.venv\Scripts\python.exe scripts\migrar_sqlite.py
```

### 2. Backend

```bat
cd Backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8001
```

La API queda en `http://127.0.0.1:8001/`. La documentación OpenAPI está en `http://127.0.0.1:8001/api/docs/`.

### 3. Frontend

```bat
cd Frontend
npm install
npm run dev
```

La aplicación queda en `http://127.0.0.1:5173/`. Vite reenvía `/api` y `/media` al backend del puerto `8001`.

## Acceso

Usuario local de verificación: `vita` / `vita` (administrador).

Los usuarios migrados desde voley 2.0 conservan su contraseña.

## Convenciones

- Tablas y columnas en mayúsculas.
- Fechas en `CHAR(8)` con formato `DDMMYYYY`.
- Identificadores con prefijo de tres letras y seis dígitos (`ALU000001`, `MEN000001`, `PAG000001`).
- El menú sale de `MODULO` y `SUBMODULO`.

## Estructura

```
Backend/     Django, procedimientos y scripts de MySQL
Frontend/    React + Vite
```

No subas `Backend/.env`. El ejemplo sin secretos está en `Backend/.env.example`.
