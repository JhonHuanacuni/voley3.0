"""Contexto de auditoría: SESSION_CONTEXT (SQL Server) o @audit_id_usuario (MySQL)."""

from django.db import connection


def set_audit_user(cursor, id_usuario):
    """Establece el usuario actor para triggers de auditoría."""
    if connection.vendor == 'mysql':
        cursor.execute("SET time_zone = '-05:00'")
        if id_usuario:
            cursor.execute('SET @audit_id_usuario = %s', [str(id_usuario).strip()])
        else:
            cursor.execute('SET @audit_id_usuario = NULL')
        return

    if id_usuario:
        cursor.execute(
            "EXEC sp_set_session_context @key=N'IDUSUARIO', @value=%s, @read_only=0",
            [str(id_usuario).strip()],
        )
    else:
        cursor.execute(
            "EXEC sp_set_session_context @key=N'IDUSUARIO', @value=NULL, @read_only=0",
        )


def prepare_write_cursor(cursor, id_usuario=None, payload=None):
    """Establece el actor de auditoría antes de escrituras."""
    if connection.vendor != 'mysql':
        cursor.execute('SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;')
    actor = id_usuario
    if not actor and payload:
        actor = payload.get('REGISTRADOPOR') or payload.get('IDREGISTRADOR')
    set_audit_user(cursor, actor)
    return actor


def actor_from_request(request, payload=None):
    """Obtiene el actor de auditoría desde header, query o campos explícitos del body."""
    for source in (
        request.headers.get('X-IdUsuario'),
        request.GET.get('idusuario'),
    ):
        if source:
            return str(source).strip()
    if payload:
        for key in ('REGISTRADOPOR', 'IDREGISTRADOR', 'idregistrador'):
            val = payload.get(key)
            if val:
                return str(val).strip()
    return None
