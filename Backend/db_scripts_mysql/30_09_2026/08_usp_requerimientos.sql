USE `VoleyDB`;

-- Requerimientos 2.12 a 2.23: trazabilidad, promociones, permisos por función y consultas.
-- Requiere 07_esquema_requerimientos.sql. La auditoría (triggers y usp_auditoria_*) está en 10_auditoria.sql.

UPDATE MENSUALIDAD m
LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
       ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
   SET m.ESTADO = CASE
         WHEN IFNULL(pg.PAGADO, 0) >= m.MONTO THEN 'Completada'
         WHEN IFNULL(pg.PAGADO, 0) > 0 THEN 'Parcial'
         ELSE 'Deuda'
       END
 WHERE m.ESTADO <> 'Inactivo';

UPDATE ALUMNA a
   SET a.INICIOMENSUALIDAD = (
         SELECT m.FECHAINICIO FROM MENSUALIDAD m WHERE m.IDALUMNA = a.IDALUMNA
         ORDER BY m.ESTADO = 'Inactivo', STR_TO_DATE(m.FECHAFIN, '%d%m%Y') DESC LIMIT 1
       ),
       a.FINMENSUALIDAD = (
         SELECT m.FECHAFIN FROM MENSUALIDAD m WHERE m.IDALUMNA = a.IDALUMNA
         ORDER BY m.ESTADO = 'Inactivo', STR_TO_DATE(m.FECHAFIN, '%d%m%Y') DESC LIMIT 1
       )
 WHERE EXISTS (SELECT 1 FROM MENSUALIDAD m WHERE m.IDALUMNA = a.IDALUMNA);

DROP PROCEDURE IF EXISTS usp_trazabilidad;
DROP PROCEDURE IF EXISTS usp_promocion_listar;
DROP PROCEDURE IF EXISTS usp_promocion_obtener;
DROP PROCEDURE IF EXISTS usp_promocion_insertar;
DROP PROCEDURE IF EXISTS usp_promocion_actualizar;
DROP PROCEDURE IF EXISTS usp_promocion_eliminar;
DROP PROCEDURE IF EXISTS usp_usuario_funciones_listar;
DROP PROCEDURE IF EXISTS usp_usuario_funciones_guardar;
DROP PROCEDURE IF EXISTS usp_cumpleanos_listar;
DROP PROCEDURE IF EXISTS usp_cumpleanos_hoy;
DROP PROCEDURE IF EXISTS usp_cumpleanos_semana;
DROP PROCEDURE IF EXISTS usp_cumpleanos_mes;
DROP PROCEDURE IF EXISTS usp_cumpleanos_conteo;
DROP FUNCTION IF EXISTS fn_proximo_cumple;
DROP PROCEDURE IF EXISTS usp_alumna_buscar_general;
DROP PROCEDURE IF EXISTS usp_estado_cuenta;
DROP PROCEDURE IF EXISTS usp_estado_cuenta_seccion;
DROP PROCEDURE IF EXISTS usp_deudas;
DROP PROCEDURE IF EXISTS usp_deudas_alumnas;
DROP PROCEDURE IF EXISTS usp_deudas_mensualidades;
DROP PROCEDURE IF EXISTS usp_deudas_proximas;
DROP PROCEDURE IF EXISTS usp_deudas_ventas;
DROP PROCEDURE IF EXISTS usp_deudas_conteo;
DROP PROCEDURE IF EXISTS usp_reporte;
DROP PROCEDURE IF EXISTS usp_ordenar_temporal;

DELIMITER $$

CREATE PROCEDURE usp_trazabilidad(IN p_Tabla VARCHAR(100), IN p_Id VARCHAR(50))
BEGIN
    SELECT IDAUDITORIA, FECHA, HORA, IDUSUARIO, ACCION, DETALLE
    FROM AUDITORIA
    WHERE TABLA = p_Tabla AND IDREGISTRO = p_Id AND ACCION <> 'Actualizado'
    ORDER BY IDAUDITORIA;
END$$

CREATE PROCEDURE usp_promocion_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4),
    IN p_Pagina INT, IN p_Tamanio INT, OUT p_Total INT
)
BEGIN
    DECLARE v_off INT DEFAULT 0;
    IF p_Pagina IS NULL OR p_Pagina < 1 THEN SET p_Pagina = 1; END IF;
    IF p_Tamanio IS NULL OR p_Tamanio < 1 THEN SET p_Tamanio = 10; END IF;
    SET v_off = (p_Pagina - 1) * p_Tamanio;
    SELECT COUNT(*) INTO p_Total FROM PROMOCION p
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR p.NOMBRE LIKE CONCAT('%', p_Buscar, '%') OR p.TIPO LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR (p_Estado = 'Activo' AND p.ACTIVO = 1) OR (p_Estado = 'Inactivo' AND p.ACTIVO = 0));
    SELECT p.IDPROMOCION, p.NOMBRE, p.TIPO, p.MONTOREGULAR, p.MONTOPROMOCIONAL, p.MESESPROMOCION,
           p.MONTOSIGUIENTES, p.FECHAINICIO, p.FECHAFIN, p.CONDICIONES,
           IF(p.ACTIVO = 1, 'Activo', 'Inactivo') AS ACTIVO,
           (SELECT COUNT(*) FROM MENSUALIDAD m WHERE m.IDPROMOCION = p.IDPROMOCION) AS USOS
    FROM PROMOCION p
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR p.NOMBRE LIKE CONCAT('%', p_Buscar, '%') OR p.TIPO LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR (p_Estado = 'Activo' AND p.ACTIVO = 1) OR (p_Estado = 'Inactivo' AND p.ACTIVO = 0))
    ORDER BY p.ACTIVO DESC, p.NOMBRE
    LIMIT v_off, p_Tamanio;
END$$

CREATE PROCEDURE usp_promocion_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT IDPROMOCION, NOMBRE, TIPO, MONTOREGULAR, MONTOPROMOCIONAL, MESESPROMOCION, MONTOSIGUIENTES,
           FECHAINICIO, FECHAFIN, CONDICIONES, IF(ACTIVO = 1, 'Activo', 'Inactivo') AS ACTIVO
    FROM PROMOCION WHERE IDPROMOCION = p_Id;
END$$

CREATE PROCEDURE usp_promocion_insertar(
    IN p_Nombre VARCHAR(120), IN p_Tipo VARCHAR(30), IN p_Regular DECIMAL(10,2), IN p_Promocional DECIMAL(10,2),
    IN p_Meses INT, IN p_Siguientes DECIMAL(10,2), IN p_Inicio CHAR(8), IN p_Fin CHAR(8),
    IN p_Condiciones VARCHAR(500), IN p_Activo VARCHAR(20),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    IF p_Nombre IS NULL OR TRIM(p_Nombre) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el nombre de la promoción.'; LEAVE proc;
    END IF;
    IF p_Promocional IS NULL OR p_Promocional < 0 THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el monto promocional.'; LEAVE proc;
    END IF;
    IF p_Regular IS NULL OR p_Regular < p_Promocional THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La tarifa regular debe ser mayor o igual al monto promocional.'; LEAVE proc;
    END IF;
    IF p_Inicio IS NOT NULL AND p_Fin IS NOT NULL AND STR_TO_DATE(p_Fin, '%d%m%Y') < STR_TO_DATE(p_Inicio, '%d%m%Y') THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La fecha de término no puede ser anterior a la de inicio.'; LEAVE proc;
    END IF;
    SELECT CONCAT('PRO', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDPROMOCION, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM PROMOCION;
    INSERT INTO PROMOCION (IDPROMOCION, NOMBRE, TIPO, MONTOREGULAR, MONTOPROMOCIONAL, MESESPROMOCION, MONTOSIGUIENTES,
                           FECHAINICIO, FECHAFIN, CONDICIONES, ACTIVO, FECHACREACION)
    VALUES (v_id, TRIM(p_Nombre), IFNULL(NULLIF(p_Tipo, ''), 'General'), p_Regular, p_Promocional,
            GREATEST(IFNULL(p_Meses, 1), 1), p_Siguientes, p_Inicio, p_Fin, p_Condiciones,
            IF(p_Activo = 'Inactivo', 0, 1), DATE_FORMAT(NOW(), '%d%m%Y'));
    SET p_Resultado = 1; SET p_Mensaje = 'Promoción registrada.';
END$$

CREATE PROCEDURE usp_promocion_actualizar(
    IN p_Id VARCHAR(50), IN p_Nombre VARCHAR(120), IN p_Tipo VARCHAR(30), IN p_Regular DECIMAL(10,2),
    IN p_Promocional DECIMAL(10,2), IN p_Meses INT, IN p_Siguientes DECIMAL(10,2), IN p_Inicio CHAR(8),
    IN p_Fin CHAR(8), IN p_Condiciones VARCHAR(500), IN p_Activo VARCHAR(20),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    IF NOT EXISTS (SELECT 1 FROM PROMOCION WHERE IDPROMOCION = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La promoción no existe.'; LEAVE proc;
    END IF;
    IF p_Nombre IS NULL OR TRIM(p_Nombre) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el nombre de la promoción.'; LEAVE proc;
    END IF;
    IF p_Regular IS NULL OR p_Promocional IS NULL OR p_Regular < p_Promocional THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La tarifa regular debe ser mayor o igual al monto promocional.'; LEAVE proc;
    END IF;
    UPDATE PROMOCION
       SET NOMBRE = TRIM(p_Nombre), TIPO = IFNULL(NULLIF(p_Tipo, ''), 'General'), MONTOREGULAR = p_Regular,
           MONTOPROMOCIONAL = p_Promocional, MESESPROMOCION = GREATEST(IFNULL(p_Meses, 1), 1),
           MONTOSIGUIENTES = p_Siguientes, FECHAINICIO = p_Inicio, FECHAFIN = p_Fin,
           CONDICIONES = p_Condiciones, ACTIVO = IF(p_Activo = 'Inactivo', 0, 1)
     WHERE IDPROMOCION = p_Id;
    SET p_Resultado = 1;
    SET p_Mensaje = 'Promoción actualizada. Los periodos ya registrados conservan su monto; los nuevos usan estos valores.';
END$$

CREATE PROCEDURE usp_promocion_eliminar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
proc: BEGIN
    DECLARE v_usos INT DEFAULT 0;
    SELECT COUNT(*) INTO v_usos FROM MENSUALIDAD WHERE IDPROMOCION = p_Id;
    IF v_usos > 0 THEN
        SET p_Resultado = 0;
        SET p_Mensaje = CONCAT('La promoción ya se usó en ', v_usos, ' mensualidades. Desactívala en lugar de eliminarla.');
        LEAVE proc;
    END IF;
    DELETE FROM PROMOCION WHERE IDPROMOCION = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Promoción eliminada.';
END$$

CREATE PROCEDURE usp_usuario_funciones_listar(IN p_IdUsuario VARCHAR(50))
BEGIN
    SELECT CODIGO FROM USUARIO_FUNCION WHERE IDUSUARIO = p_IdUsuario ORDER BY CODIGO;
END$$

-- p_Codigos: códigos separados por coma. Si no se marca ninguno se guarda NINGUNA para
-- diferenciarlo de un usuario sin configuración (que usa los permisos de su tipo).
CREATE PROCEDURE usp_usuario_funciones_guardar(
    IN p_IdUsuario VARCHAR(50), IN p_Codigos TEXT,
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_rest TEXT;
    DECLARE v_item VARCHAR(40);
    IF NOT EXISTS (SELECT 1 FROM USUARIO WHERE IDUSUARIO = p_IdUsuario) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'El usuario no existe.'; LEAVE proc;
    END IF;
    DELETE FROM USUARIO_FUNCION WHERE IDUSUARIO = p_IdUsuario;
    SET v_rest = TRIM(IFNULL(p_Codigos, ''));
    IF v_rest = '' THEN
        SET v_rest = 'NINGUNA';
    END IF;
    WHILE CHAR_LENGTH(v_rest) > 0 DO
        SET v_item = TRIM(SUBSTRING_INDEX(v_rest, ',', 1));
        IF LOCATE(',', v_rest) > 0 THEN
            SET v_rest = TRIM(SUBSTRING(v_rest, LOCATE(',', v_rest) + 1));
        ELSE
            SET v_rest = '';
        END IF;
        IF v_item <> '' THEN
            INSERT IGNORE INTO USUARIO_FUNCION (IDUSUARIO, CODIGO, FECHAREGISTRO)
            VALUES (p_IdUsuario, v_item, DATE_FORMAT(NOW(), '%d%m%Y'));
        END IF;
    END WHILE;
    CALL usp_auditoria_registrar('USUARIO', p_IdUsuario, NULL, 'Modificado', CONCAT('Permisos: ', LEFT(IFNULL(NULLIF(p_Codigos, ''), 'ninguno'), 450)));
    SET p_Resultado = 1; SET p_Mensaje = 'Permisos guardados.';
END$$

CREATE PROCEDURE usp_cumpleanos_listar(IN p_IdCiclo VARCHAR(50))
BEGIN
    SELECT a.IDALUMNA, a.NOMBRE, a.FECHANACIMIENTO, a.IDCICLO, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO,
           a.APODERADO, a.TELAPODERADO, a.TELEFONO
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
    WHERE a.ESTADO = 'Activa'
      AND STR_TO_DATE(NULLIF(a.FECHANACIMIENTO, ''), '%d%m%Y') IS NOT NULL
      AND (p_IdCiclo IS NULL OR p_IdCiclo = '' OR a.IDCICLO = p_IdCiclo)
    ORDER BY SUBSTRING(a.FECHANACIMIENTO, 3, 2), SUBSTRING(a.FECHANACIMIENTO, 1, 2), a.NOMBRE;
END$$

-- Próximo cumpleaños desde hoy (hoy incluido). Quien nació un 29 de febrero cumple el 28 en años no bisiestos.
CREATE FUNCTION fn_proximo_cumple(p_Nacimiento CHAR(8)) RETURNS DATE
DETERMINISTIC
BEGIN
    DECLARE v_nac DATE;
    DECLARE v_cumple DATE;
    SET v_nac = STR_TO_DATE(NULLIF(p_Nacimiento, ''), '%d%m%Y');
    IF v_nac IS NULL THEN
        RETURN NULL;
    END IF;
    SET v_cumple = DATE_ADD(v_nac, INTERVAL (YEAR(CURDATE()) - YEAR(v_nac)) YEAR);
    IF v_cumple < CURDATE() THEN
        SET v_cumple = DATE_ADD(v_nac, INTERVAL (YEAR(CURDATE()) - YEAR(v_nac) + 1) YEAR);
    END IF;
    RETURN v_cumple;
END$$

-- Las tres pestañas de Cumpleaños devuelven las mismas columnas:
-- DIA y MES de nacimiento, CUMPLE (edad en el próximo cumpleaños) y FALTAN (días hasta ese cumpleaños).
CREATE PROCEDURE usp_cumpleanos_hoy(IN p_IdCiclo VARCHAR(50))
BEGIN
    SELECT a.IDALUMNA, a.NOMBRE, a.IDCICLO, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO,
           a.APODERADO, a.TELAPODERADO, a.TELEFONO,
           CAST(SUBSTRING(a.FECHANACIMIENTO, 1, 2) AS UNSIGNED) AS DIA,
           CAST(SUBSTRING(a.FECHANACIMIENTO, 3, 2) AS UNSIGNED) AS MES,
           YEAR(CURDATE()) - CAST(SUBSTRING(a.FECHANACIMIENTO, 5, 4) AS UNSIGNED) AS CUMPLE,
           0 AS FALTAN
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
    WHERE a.ESTADO = 'Activa'
      AND STR_TO_DATE(NULLIF(a.FECHANACIMIENTO, ''), '%d%m%Y') IS NOT NULL
      AND (p_IdCiclo IS NULL OR p_IdCiclo = '' OR a.IDCICLO = p_IdCiclo)
      AND fn_proximo_cumple(a.FECHANACIMIENTO) = CURDATE()
    ORDER BY a.NOMBRE;
END$$

-- Semana de lunes a domingo; incluye los cumpleaños que ya pasaron en la semana.
CREATE PROCEDURE usp_cumpleanos_semana(IN p_IdCiclo VARCHAR(50))
BEGIN
    DECLARE v_lunes DATE;
    DECLARE v_domingo DATE;
    DECLARE v_md_lunes CHAR(4);
    DECLARE v_md_domingo CHAR(4);
    SET v_lunes = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);
    SET v_domingo = DATE_ADD(v_lunes, INTERVAL 6 DAY);
    SET v_md_lunes = DATE_FORMAT(v_lunes, '%m%d');
    SET v_md_domingo = DATE_FORMAT(v_domingo, '%m%d');

    SELECT x.*
    FROM (
        SELECT a.IDALUMNA, a.NOMBRE, a.IDCICLO, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO,
               a.APODERADO, a.TELAPODERADO, a.TELEFONO,
               CAST(SUBSTRING(a.FECHANACIMIENTO, 1, 2) AS UNSIGNED) AS DIA,
               CAST(SUBSTRING(a.FECHANACIMIENTO, 3, 2) AS UNSIGNED) AS MES,
               YEAR(fn_proximo_cumple(a.FECHANACIMIENTO)) - CAST(SUBSTRING(a.FECHANACIMIENTO, 5, 4) AS UNSIGNED) AS CUMPLE,
               DATEDIFF(fn_proximo_cumple(a.FECHANACIMIENTO), CURDATE()) AS FALTAN,
               CONCAT(SUBSTRING(a.FECHANACIMIENTO, 3, 2), SUBSTRING(a.FECHANACIMIENTO, 1, 2)) AS MD
        FROM ALUMNA a
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
        WHERE a.ESTADO = 'Activa'
          AND STR_TO_DATE(NULLIF(a.FECHANACIMIENTO, ''), '%d%m%Y') IS NOT NULL
          AND (p_IdCiclo IS NULL OR p_IdCiclo = '' OR a.IDCICLO = p_IdCiclo)
    ) x
    WHERE IF(v_md_lunes <= v_md_domingo,
             x.MD BETWEEN v_md_lunes AND v_md_domingo,
             x.MD >= v_md_lunes OR x.MD <= v_md_domingo)
    ORDER BY x.MD < v_md_lunes, x.MD, x.NOMBRE;
END$$

CREATE PROCEDURE usp_cumpleanos_mes(IN p_Mes INT, IN p_IdCiclo VARCHAR(50))
BEGIN
    SELECT a.IDALUMNA, a.NOMBRE, a.IDCICLO, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO,
           a.APODERADO, a.TELAPODERADO, a.TELEFONO,
           CAST(SUBSTRING(a.FECHANACIMIENTO, 1, 2) AS UNSIGNED) AS DIA,
           CAST(SUBSTRING(a.FECHANACIMIENTO, 3, 2) AS UNSIGNED) AS MES,
           YEAR(fn_proximo_cumple(a.FECHANACIMIENTO)) - CAST(SUBSTRING(a.FECHANACIMIENTO, 5, 4) AS UNSIGNED) AS CUMPLE,
           DATEDIFF(fn_proximo_cumple(a.FECHANACIMIENTO), CURDATE()) AS FALTAN
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
    WHERE a.ESTADO = 'Activa'
      AND STR_TO_DATE(NULLIF(a.FECHANACIMIENTO, ''), '%d%m%Y') IS NOT NULL
      AND (p_IdCiclo IS NULL OR p_IdCiclo = '' OR a.IDCICLO = p_IdCiclo)
      AND CAST(SUBSTRING(a.FECHANACIMIENTO, 3, 2) AS UNSIGNED) = p_Mes
    ORDER BY DIA, a.NOMBRE;
END$$

-- Totales para las pestañas, sin traer filas.
CREATE PROCEDURE usp_cumpleanos_conteo(IN p_Mes INT, IN p_IdCiclo VARCHAR(50))
BEGIN
    DECLARE v_lunes DATE;
    DECLARE v_md_lunes CHAR(4);
    DECLARE v_md_domingo CHAR(4);
    SET v_lunes = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);
    SET v_md_lunes = DATE_FORMAT(v_lunes, '%m%d');
    SET v_md_domingo = DATE_FORMAT(DATE_ADD(v_lunes, INTERVAL 6 DAY), '%m%d');

    SELECT IFNULL(SUM(fn_proximo_cumple(x.FECHANACIMIENTO) = CURDATE()), 0) AS HOY,
           IFNULL(SUM(IF(v_md_lunes <= v_md_domingo,
                         x.MD BETWEEN v_md_lunes AND v_md_domingo,
                         x.MD >= v_md_lunes OR x.MD <= v_md_domingo)), 0) AS SEMANA,
           IFNULL(SUM(CAST(SUBSTRING(x.MD, 1, 2) AS UNSIGNED) = p_Mes), 0) AS MES
    FROM (
        SELECT a.FECHANACIMIENTO,
               CONCAT(SUBSTRING(a.FECHANACIMIENTO, 3, 2), SUBSTRING(a.FECHANACIMIENTO, 1, 2)) AS MD
        FROM ALUMNA a
        WHERE a.ESTADO = 'Activa'
          AND STR_TO_DATE(NULLIF(a.FECHANACIMIENTO, ''), '%d%m%Y') IS NOT NULL
          AND (p_IdCiclo IS NULL OR p_IdCiclo = '' OR a.IDCICLO = p_IdCiclo)
    ) x;
END$$

CREATE PROCEDURE usp_alumna_buscar_general(IN p_Texto VARCHAR(100))
BEGIN
    DECLARE v_t VARCHAR(100);
    SET v_t = TRIM(IFNULL(p_Texto, ''));
    SELECT a.IDALUMNA, UPPER(a.NOMBRE) AS NOMBRE, a.DNI, a.TELEFONO, a.TELAPODERADO, a.ESTADO, UPPER(c.NOMBRE) AS CICLO
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    WHERE CHAR_LENGTH(v_t) >= 2
      AND (a.NOMBRE LIKE CONCAT('%', v_t, '%')
           OR a.IDALUMNA LIKE CONCAT('%', v_t, '%')
           OR IFNULL(a.DNI, '') LIKE CONCAT(v_t, '%')
           OR IFNULL(a.TELEFONO, '') LIKE CONCAT('%', v_t, '%')
           OR IFNULL(a.TELAPODERADO, '') LIKE CONCAT('%', v_t, '%')
           OR IFNULL(a.DNIAPODERADO, '') LIKE CONCAT(v_t, '%')
           OR IFNULL(a.APODERADO, '') LIKE CONCAT('%', v_t, '%'))
    ORDER BY a.ESTADO = 'Activa' DESC, a.NOMBRE
    LIMIT 12;
END$$

-- Una pestaña del estado de cuenta: mensualidades, pagos, ventas, productos o abonos.
-- p_Estado solo aplica a mensualidades: 'pagadas' (Completada), 'pendientes' (Deuda o Parcial) o vacío para todas.
-- p_OrdenarPor / p_Direccion: columna del resultado y ASC o DESC (vacío = orden por defecto).
CREATE PROCEDURE usp_estado_cuenta_seccion(
    IN p_IdAlumna VARCHAR(50), IN p_Seccion VARCHAR(20), IN p_Estado VARCHAR(20),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4)
)
BEGIN
    DECLARE v_nombre VARCHAR(120);
    DECLARE v_estado VARCHAR(20);
    SELECT NOMBRE INTO v_nombre FROM ALUMNA WHERE IDALUMNA = p_IdAlumna;
    SET v_estado = LOWER(TRIM(IFNULL(p_Estado, '')));

    DROP TEMPORARY TABLE IF EXISTS tmp_estado_cuenta;

    IF p_Seccion = 'mensualidades' THEN
        CREATE TEMPORARY TABLE tmp_estado_cuenta AS
        SELECT m.IDMENSUALIDAD, m.FECHAINICIO, m.FECHAFIN, m.MONTOREGULAR, m.MONTO,
               GREATEST(IFNULL(m.MONTOREGULAR, m.MONTO) - m.MONTO, 0) AS DESCUENTO,
               IFNULL(pg.PAGADO, 0) AS PAGADO,
               IF(m.ESTADO = 'Inactivo', 0, GREATEST(m.MONTO - IFNULL(pg.PAGADO, 0), 0)) AS SALDO,
               m.ESTADO, pr.NOMBRE AS PROMOCION,
               IF(m.ESTADO IN ('Deuda', 'Parcial') AND STR_TO_DATE(m.FECHAFIN, '%d%m%Y') < CURDATE(), 1, 0) AS VENCIDA,
               fn_traza('MENSUALIDAD', m.IDMENSUALIDAD, 'R') AS REGISTRADOPOR,
               fn_traza('MENSUALIDAD', m.IDMENSUALIDAD, 'M') AS MODIFICADOPOR,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') DESC, m.IDMENSUALIDAD DESC) AS ORDEN
        FROM MENSUALIDAD m
        LEFT JOIN PROMOCION pr ON pr.IDPROMOCION = m.IDPROMOCION
        LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
               ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
        WHERE m.IDALUMNA = p_IdAlumna
          AND (v_estado = ''
               OR (v_estado = 'pagadas' AND m.ESTADO = 'Completada')
               OR (v_estado = 'pendientes' AND m.ESTADO IN ('Deuda', 'Parcial')));

    ELSEIF p_Seccion = 'pagos' THEN
        CREATE TEMPORARY TABLE tmp_estado_cuenta AS
        SELECT p.IDPAGO, p.FECHA, p.MONTO, p.MEDIO, p.IDMENSUALIDAD,
               CONCAT(fn_fecha_vista(m.FECHAINICIO), ' - ', fn_fecha_vista(m.FECHAFIN)) AS PERIODO,
               m.FECHAINICIO AS FECHAPERIODO,
               IF(p.MONTO < m.MONTO, 1, 0) AS PARCIAL,
               fn_traza('PAGO', p.IDPAGO, 'R') AS REGISTRADOPOR,
               fn_traza('PAGO', p.IDPAGO, 'M') AS MODIFICADOPOR,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(p.FECHA, '%d%m%Y') DESC, p.IDPAGO DESC) AS ORDEN
        FROM PAGO p
        LEFT JOIN MENSUALIDAD m ON m.IDMENSUALIDAD = p.IDMENSUALIDAD
        WHERE p.IDALUMNA = p_IdAlumna;

    ELSEIF p_Seccion = 'ventas' THEN
        CREATE TEMPORARY TABLE tmp_estado_cuenta AS
        SELECT v.IDVENTA, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.FECHA, v.TIPO, v.PRODUCTO, v.PRECIO,
               IFNULL(v.ACUENTA, v.PRECIO) AS PAGADO,
               IF(v.ESTADO_RECIBO = 'Emitido', GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0), 0) AS SALDO,
               v.MEDIO, v.ESTADO_RECIBO,
               IF(v.TIPO = 'Servicio' AND v.PRODUCTO LIKE 'Clases individuales%', 1, 0) AS CLASE,
               CONCAT(IFNULL(v.USUARIO_EMISION, 'sin usuario'), ' – ', fn_fecha_vista(v.FECHA_EMISION), ' ', LEFT(IFNULL(v.HORA_EMISION, ''), 5)) AS REGISTRADOPOR,
               IF(v.USUARIO_MODIFICACION IS NULL, NULL,
                  CONCAT(v.USUARIO_MODIFICACION, ' – ', fn_fecha_vista(v.FECHA_MODIFICACION), ' ', LEFT(IFNULL(v.HORA_MODIFICACION, ''), 5))) AS MODIFICADOPOR,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(v.FECHA, '%d%m%Y') DESC, v.IDVENTA DESC) AS ORDEN
        FROM VENTA v
        WHERE v.IDALUMNA = p_IdAlumna OR (v.IDALUMNA IS NULL AND v.NOMBRE = v_nombre);

    ELSEIF p_Seccion = 'productos' THEN
        CREATE TEMPORARY TABLE tmp_estado_cuenta AS
        SELECT d.PRODUCTO, d.TALLA, d.PRECIO, v.FECHA, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.TIPO,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(v.FECHA, '%d%m%Y') DESC, v.IDVENTA DESC, d.ORDEN) AS ORDEN
        FROM VENTA_DETALLE d
        INNER JOIN VENTA v ON v.IDVENTA = d.IDVENTA
        WHERE (v.IDALUMNA = p_IdAlumna OR (v.IDALUMNA IS NULL AND v.NOMBRE = v_nombre))
          AND v.ESTADO_RECIBO = 'Emitido';

    ELSEIF p_Seccion = 'abonos' THEN
        CREATE TEMPORARY TABLE tmp_estado_cuenta AS
        SELECT ab.IDABONO, ab.FECHA, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.PRODUCTO, v.PRECIO,
               ab.MONTO, ab.MEDIO, ab.ORIGEN,
               GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0) AS SALDO,
               CONCAT(IFNULL(ab.IDUSUARIO, 'sin usuario'), ' – ', fn_fecha_vista(ab.FECHAREGISTRO), ' ', LEFT(IFNULL(ab.HORAREGISTRO, ''), 5)) AS REGISTRADOPOR,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(ab.FECHA, '%d%m%Y') DESC, ab.IDABONO DESC) AS ORDEN
        FROM VENTA_ABONO ab
        INNER JOIN VENTA v ON v.IDVENTA = ab.IDVENTA
        WHERE (v.IDALUMNA = p_IdAlumna OR (v.IDALUMNA IS NULL AND v.NOMBRE = v_nombre))
          AND v.ESTADO_RECIBO = 'Emitido';

    ELSE
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sección de estado de cuenta no válida';
    END IF;

    CALL usp_ordenar_temporal('tmp_estado_cuenta', p_OrdenarPor, p_Direccion);
    DROP TEMPORARY TABLE IF EXISTS tmp_estado_cuenta;
END$$

-- Devuelve seis conjuntos: alumna, mensualidades, pagos, ventas, productos adquiridos y abonos.
CREATE PROCEDURE usp_estado_cuenta(IN p_IdAlumna VARCHAR(50))
BEGIN
    SELECT a.*, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO,
           fn_traza('ALUMNA', a.IDALUMNA, 'R') AS MATRICULADOPOR,
           fn_traza('ALUMNA', a.IDALUMNA, 'M') AS MODIFICADOPOR
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
    WHERE a.IDALUMNA = p_IdAlumna;

    CALL usp_estado_cuenta_seccion(p_IdAlumna, 'mensualidades', '', '', '');
    CALL usp_estado_cuenta_seccion(p_IdAlumna, 'pagos', '', '', '');
    CALL usp_estado_cuenta_seccion(p_IdAlumna, 'ventas', '', '', '');
    CALL usp_estado_cuenta_seccion(p_IdAlumna, 'productos', '', '', '');
    CALL usp_estado_cuenta_seccion(p_IdAlumna, 'abonos', '', '', '');
END$$

-- Tres conjuntos: mensualidades con saldo, periodos que terminan pronto y ventas con saldo.
-- p_Buscar compara con el nombre de la alumna y, en ventas, también con el número de recibo.
CREATE PROCEDURE usp_deudas(IN p_Dias INT, IN p_Buscar VARCHAR(100), IN p_IdCiclo VARCHAR(50))
BEGIN
    DECLARE v_dias INT;
    DECLARE v_buscar VARCHAR(100);
    DECLARE v_ciclo VARCHAR(50);
    SET v_dias = IFNULL(p_Dias, 7);
    SET v_buscar = TRIM(IFNULL(p_Buscar, ''));
    SET v_ciclo = NULLIF(TRIM(IFNULL(p_IdCiclo, '')), '');

    SELECT m.IDMENSUALIDAD, m.IDALUMNA, a.NOMBRE AS ALUMNA, a.ESTADO AS ESTADOALUMNA, c.NOMBRE AS CICLO,
           a.TELAPODERADO, m.FECHAINICIO, m.FECHAFIN, m.MONTO,
           IFNULL(pg.PAGADO, 0) AS PAGADO,
           GREATEST(m.MONTO - IFNULL(pg.PAGADO, 0), 0) AS SALDO,
           DATEDIFF(STR_TO_DATE(m.FECHAFIN, '%d%m%Y'), CURDATE()) AS DIAS,
           CASE
             WHEN STR_TO_DATE(m.FECHAFIN, '%d%m%Y') < CURDATE() THEN 'Vencida'
             WHEN STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') <= CURDATE() THEN 'En curso'
             ELSE 'Por iniciar'
           END AS SITUACION
    FROM MENSUALIDAD m
    INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
           ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
    WHERE m.ESTADO IN ('Deuda', 'Parcial')
      AND m.MONTO - IFNULL(pg.PAGADO, 0) > 0
      AND (v_buscar = '' OR a.NOMBRE LIKE CONCAT('%', v_buscar, '%'))
      AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
    ORDER BY STR_TO_DATE(m.FECHAFIN, '%d%m%Y'), a.NOMBRE;

    SELECT a.IDALUMNA, a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO, a.TELAPODERADO,
           a.INICIOMENSUALIDAD AS FECHAINICIO, a.FINMENSUALIDAD AS FECHAFIN,
           DATEDIFF(STR_TO_DATE(a.FINMENSUALIDAD, '%d%m%Y'), CURDATE()) AS DIAS
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    WHERE a.ESTADO = 'Activa'
      AND STR_TO_DATE(NULLIF(a.FINMENSUALIDAD, ''), '%d%m%Y') BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL v_dias DAY)
      AND (v_buscar = '' OR a.NOMBRE LIKE CONCAT('%', v_buscar, '%'))
      AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
    ORDER BY STR_TO_DATE(a.FINMENSUALIDAD, '%d%m%Y'), a.NOMBRE;

    SELECT v.IDVENTA, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.FECHA, v.NOMBRE AS ALUMNA, v.IDALUMNA,
           c.NOMBRE AS CICLO, v.TIPO, v.PRODUCTO, v.PRECIO,
           IFNULL(v.ACUENTA, v.PRECIO) AS PAGADO,
           GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0) AS SALDO
    FROM VENTA v
    LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    WHERE v.ESTADO_RECIBO = 'Emitido'
      AND v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO) > 0
      AND (v_buscar = ''
           OR v.NOMBRE LIKE CONCAT('%', v_buscar, '%')
           OR IFNULL(v.COMPROBANTE, v.IDVENTA) LIKE CONCAT('%', v_buscar, '%'))
      AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
    ORDER BY STR_TO_DATE(v.FECHA, '%d%m%Y'), v.NOMBRE;
END$$

-- Devuelve las filas de una tabla temporal ordenadas por la columna pedida.
-- La tabla debe traer la columna ORDEN con el orden por defecto, que también desempata.
-- Las columnas de fecha (FECHA..., FINMENSUALIDAD) están en CHAR(8) DDMMYYYY y se ordenan como fecha real.
-- Si la columna no existe en la tabla se usa el orden por defecto.
CREATE PROCEDURE usp_ordenar_temporal(IN p_Tabla VARCHAR(64), IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4))
BEGIN
    DECLARE v_col VARCHAR(50);
    DECLARE v_dir VARCHAR(4);
    DECLARE v_clave VARCHAR(200);

    IF p_Tabla NOT REGEXP '^tmp_[a-z_]+$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tabla temporal no válida';
    END IF;

    SET v_col = UPPER(TRIM(IFNULL(p_OrdenarPor, '')));
    SET v_dir = IF(UPPER(TRIM(IFNULL(p_Direccion, ''))) = 'DESC', 'DESC', 'ASC');
    IF v_col NOT REGEXP '^[A-Z_]{1,40}$' THEN
        SET v_col = '';
    END IF;

    IF v_col = '' THEN
        SET @sql_orden = CONCAT('SELECT * FROM ', p_Tabla, ' ORDER BY ORDEN');
    ELSE
        IF v_col LIKE 'FECHA%' OR v_col = 'FINMENSUALIDAD' THEN
            SET v_clave = CONCAT('STR_TO_DATE(NULLIF(`', v_col, '`, ''''), ''%d%m%Y'')');
        ELSE
            SET v_clave = CONCAT('`', v_col, '`');
        END IF;
        SET @sql_orden = CONCAT('SELECT * FROM ', p_Tabla, ' ORDER BY ', v_clave, ' ', v_dir, ', ORDEN');
    END IF;

    BEGIN
        DECLARE EXIT HANDLER FOR 1054
        BEGIN
            SET @sql_orden = CONCAT('SELECT * FROM ', p_Tabla, ' ORDER BY ORDEN');
            PREPARE stmt_orden FROM @sql_orden;
            EXECUTE stmt_orden;
            DEALLOCATE PREPARE stmt_orden;
        END;
        PREPARE stmt_orden FROM @sql_orden;
        EXECUTE stmt_orden;
        DEALLOCATE PREPARE stmt_orden;
    END;
END$$

-- Pestañas de Deudas y vencimientos: un procedimiento por pestaña.
-- p_Buscar compara con el nombre de la alumna y, en ventas, también con el número de recibo.
-- p_OrdenarPor / p_Direccion: columna del resultado y ASC o DESC (vacío = orden por defecto).
CREATE PROCEDURE usp_deudas_mensualidades(
    IN p_Buscar VARCHAR(100), IN p_IdCiclo VARCHAR(50),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4)
)
BEGIN
    DECLARE v_buscar VARCHAR(100);
    DECLARE v_ciclo VARCHAR(50);
    SET v_buscar = TRIM(IFNULL(p_Buscar, ''));
    SET v_ciclo = NULLIF(TRIM(IFNULL(p_IdCiclo, '')), '');

    DROP TEMPORARY TABLE IF EXISTS tmp_deudas;
    CREATE TEMPORARY TABLE tmp_deudas AS
    SELECT m.IDMENSUALIDAD, m.IDALUMNA, a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO, a.TELAPODERADO,
           m.FECHAINICIO, m.FECHAFIN, m.MONTO,
           IFNULL(pg.PAGADO, 0) AS PAGADO,
           GREATEST(m.MONTO - IFNULL(pg.PAGADO, 0), 0) AS SALDO,
           DATEDIFF(STR_TO_DATE(m.FECHAFIN, '%d%m%Y'), CURDATE()) AS DIAS,
           CASE
             WHEN STR_TO_DATE(m.FECHAFIN, '%d%m%Y') < CURDATE() THEN 'Vencida'
             WHEN STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') <= CURDATE() THEN 'En curso'
             ELSE 'Por iniciar'
           END AS SITUACION,
           ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(m.FECHAFIN, '%d%m%Y'), a.NOMBRE) AS ORDEN
    FROM MENSUALIDAD m
    INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
           ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
    WHERE m.ESTADO IN ('Deuda', 'Parcial')
      AND m.MONTO - IFNULL(pg.PAGADO, 0) > 0
      AND (v_buscar = '' OR a.NOMBRE LIKE CONCAT('%', v_buscar, '%'))
      AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo);

    CALL usp_ordenar_temporal('tmp_deudas', p_OrdenarPor, p_Direccion);
    DROP TEMPORARY TABLE IF EXISTS tmp_deudas;
END$$

CREATE PROCEDURE usp_deudas_proximas(
    IN p_Dias INT, IN p_Buscar VARCHAR(100), IN p_IdCiclo VARCHAR(50),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4)
)
BEGIN
    DECLARE v_dias INT;
    DECLARE v_buscar VARCHAR(100);
    DECLARE v_ciclo VARCHAR(50);
    SET v_dias = IFNULL(p_Dias, 7);
    SET v_buscar = TRIM(IFNULL(p_Buscar, ''));
    SET v_ciclo = NULLIF(TRIM(IFNULL(p_IdCiclo, '')), '');

    DROP TEMPORARY TABLE IF EXISTS tmp_deudas;
    CREATE TEMPORARY TABLE tmp_deudas AS
    SELECT a.IDALUMNA, a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO, a.TELAPODERADO,
           a.INICIOMENSUALIDAD AS FECHAINICIO, a.FINMENSUALIDAD AS FECHAFIN,
           DATEDIFF(STR_TO_DATE(a.FINMENSUALIDAD, '%d%m%Y'), CURDATE()) AS DIAS,
           ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(a.FINMENSUALIDAD, '%d%m%Y'), a.NOMBRE) AS ORDEN
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    WHERE a.ESTADO = 'Activa'
      AND STR_TO_DATE(NULLIF(a.FINMENSUALIDAD, ''), '%d%m%Y') BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL v_dias DAY)
      AND (v_buscar = '' OR a.NOMBRE LIKE CONCAT('%', v_buscar, '%'))
      AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo);

    CALL usp_ordenar_temporal('tmp_deudas', p_OrdenarPor, p_Direccion);
    DROP TEMPORARY TABLE IF EXISTS tmp_deudas;
END$$

-- p_Tipo: 'Producto físico', 'Servicio' o vacío para ambos.
CREATE PROCEDURE usp_deudas_ventas(
    IN p_Buscar VARCHAR(100), IN p_IdCiclo VARCHAR(50), IN p_Tipo VARCHAR(30),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4)
)
BEGIN
    DECLARE v_buscar VARCHAR(100);
    DECLARE v_ciclo VARCHAR(50);
    DECLARE v_tipo VARCHAR(30);
    SET v_buscar = TRIM(IFNULL(p_Buscar, ''));
    SET v_ciclo = NULLIF(TRIM(IFNULL(p_IdCiclo, '')), '');
    SET v_tipo = NULLIF(TRIM(IFNULL(p_Tipo, '')), '');

    DROP TEMPORARY TABLE IF EXISTS tmp_deudas;
    CREATE TEMPORARY TABLE tmp_deudas AS
    SELECT v.IDVENTA, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.FECHA, v.NOMBRE AS ALUMNA, v.IDALUMNA,
           c.NOMBRE AS CICLO, v.TIPO, v.PRODUCTO, v.PRECIO,
           IFNULL(v.ACUENTA, v.PRECIO) AS PAGADO,
           GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0) AS SALDO,
           ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(v.FECHA, '%d%m%Y'), v.NOMBRE) AS ORDEN
    FROM VENTA v
    LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    WHERE v.ESTADO_RECIBO = 'Emitido'
      AND v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO) > 0
      AND (v_buscar = ''
           OR v.NOMBRE LIKE CONCAT('%', v_buscar, '%')
           OR IFNULL(v.COMPROBANTE, v.IDVENTA) LIKE CONCAT('%', v_buscar, '%'))
      AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
      AND (v_tipo IS NULL OR v.TIPO = v_tipo);

    CALL usp_ordenar_temporal('tmp_deudas', p_OrdenarPor, p_Direccion);
    DROP TEMPORARY TABLE IF EXISTS tmp_deudas;
END$$

-- Deuda consolidada por alumna: mensualidades con saldo más ventas con saldo.
-- Las ventas sin alumna vinculada se agrupan por el nombre escrito en el recibo.
CREATE PROCEDURE usp_deudas_alumnas(
    IN p_Buscar VARCHAR(100), IN p_IdCiclo VARCHAR(50),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4)
)
BEGIN
    DECLARE v_buscar VARCHAR(100);
    DECLARE v_ciclo VARCHAR(50);
    SET v_buscar = TRIM(IFNULL(p_Buscar, ''));
    SET v_ciclo = NULLIF(TRIM(IFNULL(p_IdCiclo, '')), '');

    DROP TEMPORARY TABLE IF EXISTS tmp_deudas;
    CREATE TEMPORARY TABLE tmp_deudas AS
    SELECT MAX(x.IDALUMNA) AS IDALUMNA, MAX(x.ALUMNA) AS ALUMNA, MAX(x.CICLO) AS CICLO,
           MAX(x.TELAPODERADO) AS TELAPODERADO,
           SUM(x.VENCIDA) AS VENCIDAS,
           ROUND(SUM(x.MEN), 2) AS MENSUALIDADES,
           ROUND(SUM(x.PROD), 2) AS PRODUCTOS,
           ROUND(SUM(x.SERV), 2) AS SERVICIOS,
           ROUND(SUM(x.MEN + x.PROD + x.SERV), 2) AS TOTAL,
           ROW_NUMBER() OVER (ORDER BY SUM(x.MEN + x.PROD + x.SERV) DESC, MAX(x.ALUMNA)) AS ORDEN
    FROM (
        SELECT m.IDALUMNA AS CLAVE, m.IDALUMNA, a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO, a.TELAPODERADO,
               IF(STR_TO_DATE(m.FECHAFIN, '%d%m%Y') < CURDATE(), 1, 0) AS VENCIDA,
               GREATEST(m.MONTO - IFNULL(pg.PAGADO, 0), 0) AS MEN, 0 AS PROD, 0 AS SERV
        FROM MENSUALIDAD m
        INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
               ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
        WHERE m.ESTADO IN ('Deuda', 'Parcial')
          AND m.MONTO - IFNULL(pg.PAGADO, 0) > 0
          AND (v_buscar = '' OR a.NOMBRE LIKE CONCAT('%', v_buscar, '%'))
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        UNION ALL
        SELECT IFNULL(v.IDALUMNA, CONCAT('NOMBRE:', v.NOMBRE)), v.IDALUMNA, v.NOMBRE, c.NOMBRE, NULL, 0, 0,
               IF(v.TIPO = 'Servicio', 0, GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0)),
               IF(v.TIPO = 'Servicio', GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0), 0)
        FROM VENTA v
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        WHERE v.ESTADO_RECIBO = 'Emitido'
          AND v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO) > 0
          AND (v_buscar = ''
               OR v.NOMBRE LIKE CONCAT('%', v_buscar, '%')
               OR IFNULL(v.COMPROBANTE, v.IDVENTA) LIKE CONCAT('%', v_buscar, '%'))
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
    ) x
    GROUP BY x.CLAVE;

    CALL usp_ordenar_temporal('tmp_deudas', p_OrdenarPor, p_Direccion);
    DROP TEMPORARY TABLE IF EXISTS tmp_deudas;
END$$

-- Totales de las pestañas y de los avisos, sin traer filas.
CREATE PROCEDURE usp_deudas_conteo(IN p_Dias INT, IN p_Buscar VARCHAR(100), IN p_IdCiclo VARCHAR(50))
BEGIN
    DECLARE v_dias INT;
    DECLARE v_buscar VARCHAR(100);
    DECLARE v_ciclo VARCHAR(50);
    SET v_dias = IFNULL(p_Dias, 7);
    SET v_buscar = TRIM(IFNULL(p_Buscar, ''));
    SET v_ciclo = NULLIF(TRIM(IFNULL(p_IdCiclo, '')), '');

    SELECT
        (SELECT COUNT(DISTINCT k.CLAVE) FROM (
            SELECT m.IDALUMNA AS CLAVE
            FROM MENSUALIDAD m
            INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
            LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
                   ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
            WHERE m.ESTADO IN ('Deuda', 'Parcial') AND m.MONTO - IFNULL(pg.PAGADO, 0) > 0
              AND (v_buscar = '' OR a.NOMBRE LIKE CONCAT('%', v_buscar, '%'))
              AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
            UNION ALL
            SELECT IFNULL(v.IDALUMNA, CONCAT('NOMBRE:', v.NOMBRE))
            FROM VENTA v
            LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
            WHERE v.ESTADO_RECIBO = 'Emitido' AND v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO) > 0
              AND (v_buscar = '' OR v.NOMBRE LIKE CONCAT('%', v_buscar, '%')
                   OR IFNULL(v.COMPROBANTE, v.IDVENTA) LIKE CONCAT('%', v_buscar, '%'))
              AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        ) k) AS ALUMNAS,
        IFNULL(men.CANTIDAD, 0) AS MENSUALIDADES,
        IFNULL(men.VENCIDAS, 0) AS VENCIDAS,
        IFNULL(men.MONTOVENCIDO, 0) AS MONTOVENCIDO,
        IFNULL(men.SALDO, 0) AS MONTOMENSUALIDADES,
        (SELECT COUNT(*) FROM ALUMNA a
          WHERE a.ESTADO = 'Activa'
            AND STR_TO_DATE(NULLIF(a.FINMENSUALIDAD, ''), '%d%m%Y') BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL v_dias DAY)
            AND (v_buscar = '' OR a.NOMBRE LIKE CONCAT('%', v_buscar, '%'))
            AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)) AS PROXIMAS,
        IFNULL(ven.CANTIDAD, 0) AS VENTAS,
        IFNULL(ven.PRODUCTOS, 0) AS PRODUCTOS,
        IFNULL(ven.SERVICIOS, 0) AS SERVICIOS
    FROM (
        SELECT COUNT(*) AS CANTIDAD,
               SUM(STR_TO_DATE(m.FECHAFIN, '%d%m%Y') < CURDATE()) AS VENCIDAS,
               SUM(IF(STR_TO_DATE(m.FECHAFIN, '%d%m%Y') < CURDATE(), m.MONTO - IFNULL(pg.PAGADO, 0), 0)) AS MONTOVENCIDO,
               SUM(m.MONTO - IFNULL(pg.PAGADO, 0)) AS SALDO
        FROM MENSUALIDAD m
        INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
        LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
               ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
        WHERE m.ESTADO IN ('Deuda', 'Parcial') AND m.MONTO - IFNULL(pg.PAGADO, 0) > 0
          AND (v_buscar = '' OR a.NOMBRE LIKE CONCAT('%', v_buscar, '%'))
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
    ) men
    CROSS JOIN (
        SELECT COUNT(*) AS CANTIDAD,
               SUM(IF(v.TIPO = 'Servicio', 0, v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO))) AS PRODUCTOS,
               SUM(IF(v.TIPO = 'Servicio', v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0)) AS SERVICIOS
        FROM VENTA v
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        WHERE v.ESTADO_RECIBO = 'Emitido' AND v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO) > 0
          AND (v_buscar = '' OR v.NOMBRE LIKE CONCAT('%', v_buscar, '%')
               OR IFNULL(v.COMPROBANTE, v.IDVENTA) LIKE CONCAT('%', v_buscar, '%'))
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
    ) ven;
END$$

-- p_OrdenarPor / p_Direccion: columna del resultado y ASC o DESC (vacío = orden por defecto de cada reporte).
CREATE PROCEDURE usp_reporte(
    IN p_Tipo VARCHAR(30), IN p_Desde CHAR(8), IN p_Hasta CHAR(8), IN p_IdCiclo VARCHAR(50),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4)
)
BEGIN
    DECLARE v_desde DATE;
    DECLARE v_hasta DATE;
    DECLARE v_ciclo VARCHAR(50);
    SET v_desde = STR_TO_DATE(NULLIF(p_Desde, ''), '%d%m%Y');
    SET v_hasta = STR_TO_DATE(NULLIF(p_Hasta, ''), '%d%m%Y');
    SET v_ciclo = NULLIF(p_IdCiclo, '');

    DROP TEMPORARY TABLE IF EXISTS tmp_reporte;

    IF p_Tipo = 'matriculas' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT a.FECHAINSCRIPCION AS FECHA, a.NOMBRE AS ALUMNA, a.DNI, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO, a.ESTADO,
               (SELECT m.MONTO FROM MENSUALIDAD m WHERE m.IDALUMNA = a.IDALUMNA
                 ORDER BY STR_TO_DATE(m.FECHAINICIO, '%d%m%Y'), m.IDMENSUALIDAD LIMIT 1) AS MONTO,
               fn_traza('ALUMNA', a.IDALUMNA, 'R') AS REGISTRADOPOR,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(a.FECHAINSCRIPCION, '%d%m%Y'), a.NOMBRE) AS ORDEN
        FROM ALUMNA a
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
        WHERE STR_TO_DATE(NULLIF(a.FECHAINSCRIPCION, ''), '%d%m%Y') IS NOT NULL
          AND (v_desde IS NULL OR STR_TO_DATE(a.FECHAINSCRIPCION, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(a.FECHAINSCRIPCION, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo);

    ELSEIF p_Tipo = 'mensualidades' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO, m.FECHAINICIO, m.FECHAFIN, m.MONTOREGULAR, m.MONTO,
               GREATEST(IFNULL(m.MONTOREGULAR, m.MONTO) - m.MONTO, 0) AS DESCUENTO,
               IFNULL(pg.PAGADO, 0) AS PAGADO,
               IF(m.ESTADO = 'Inactivo', 0, GREATEST(m.MONTO - IFNULL(pg.PAGADO, 0), 0)) AS SALDO,
               m.ESTADO, pr.NOMBRE AS PROMOCION,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(m.FECHAINICIO, '%d%m%Y'), a.NOMBRE) AS ORDEN
        FROM MENSUALIDAD m
        INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN PROMOCION pr ON pr.IDPROMOCION = m.IDPROMOCION
        LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
               ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
        WHERE (v_desde IS NULL OR STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo);

    ELSEIF p_Tipo = 'ventas' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.FECHA, v.NOMBRE, c.NOMBRE AS CICLO, v.TIPO, v.PRODUCTO,
               v.PRECIO, IFNULL(v.ACUENTA, v.PRECIO) AS PAGADO,
               IF(v.ESTADO_RECIBO = 'Emitido', GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0), 0) AS SALDO,
               v.MEDIO, v.ESTADO_RECIBO AS ESTADO, v.USUARIO_EMISION AS REGISTRADOPOR,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(v.FECHA, '%d%m%Y'), v.IDVENTA) AS ORDEN
        FROM VENTA v
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        WHERE v.ESTADO_RECIBO <> 'Eliminado'
          AND (v_desde IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo);

    ELSEIF p_Tipo = 'productos' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT d.PRODUCTO, IFNULL(d.TALLA, '') AS TALLA, COUNT(*) AS CANTIDAD, SUM(d.PRECIO) AS TOTAL,
               ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, d.PRODUCTO) AS ORDEN
        FROM VENTA_DETALLE d
        INNER JOIN VENTA v ON v.IDVENTA = d.IDVENTA
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        WHERE v.ESTADO_RECIBO = 'Emitido' AND v.TIPO = 'Producto físico'
          AND (v_desde IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        GROUP BY d.PRODUCTO, IFNULL(d.TALLA, '');

    ELSEIF p_Tipo = 'clases' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT v.FECHA, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.NOMBRE, c.NOMBRE AS CICLO, v.PRECIO,
               IFNULL(v.ACUENTA, v.PRECIO) AS PAGADO,
               GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0) AS SALDO,
               v.MEDIO, v.USUARIO_EMISION AS REGISTRADOPOR,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(v.FECHA, '%d%m%Y'), v.IDVENTA) AS ORDEN
        FROM VENTA v
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        WHERE v.ESTADO_RECIBO = 'Emitido' AND v.TIPO = 'Servicio' AND v.PRODUCTO LIKE 'Clases individuales%'
          AND (v_desde IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo);

    ELSEIF p_Tipo = 'pagos' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT p.FECHA, p.IDPAGO, a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO,
               CONCAT(fn_fecha_vista(m.FECHAINICIO), ' - ', fn_fecha_vista(m.FECHAFIN)) AS PERIODO,
               p.MONTO, p.MEDIO, fn_traza('PAGO', p.IDPAGO, 'R') AS REGISTRADOPOR,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(p.FECHA, '%d%m%Y'), p.IDPAGO) AS ORDEN
        FROM PAGO p
        INNER JOIN ALUMNA a ON a.IDALUMNA = p.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN MENSUALIDAD m ON m.IDMENSUALIDAD = p.IDMENSUALIDAD
        WHERE (v_desde IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo);

    ELSEIF p_Tipo = 'saldos' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT s.*, ROW_NUMBER() OVER (ORDER BY s.ALUMNA, STR_TO_DATE(s.FECHA, '%d%m%Y')) AS ORDEN FROM (
            SELECT 'Mensualidad' AS TIPO, a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO,
                   CONCAT('Periodo ', fn_fecha_vista(m.FECHAINICIO), ' - ', fn_fecha_vista(m.FECHAFIN)) AS CONCEPTO,
                   m.FECHAFIN AS FECHA, m.MONTO AS TOTAL, IFNULL(pg.PAGADO, 0) AS PAGADO,
                   GREATEST(m.MONTO - IFNULL(pg.PAGADO, 0), 0) AS SALDO
            FROM MENSUALIDAD m
            INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
            LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
            LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
                   ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
            WHERE m.ESTADO IN ('Deuda', 'Parcial') AND m.MONTO - IFNULL(pg.PAGADO, 0) > 0
              AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
            UNION ALL
            SELECT IF(v.TIPO = 'Servicio', 'Servicio', 'Producto') AS TIPO, v.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO,
                   CONCAT(IFNULL(v.COMPROBANTE, v.IDVENTA), ' · ', IFNULL(v.PRODUCTO, '')) AS CONCEPTO,
                   v.FECHA, v.PRECIO AS TOTAL, IFNULL(v.ACUENTA, v.PRECIO) AS PAGADO,
                   GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0) AS SALDO
            FROM VENTA v
            LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
            LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
            WHERE v.ESTADO_RECIBO = 'Emitido' AND v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO) > 0
              AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        ) s;

    ELSEIF p_Tipo = 'activas' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT a.NOMBRE AS ALUMNA, a.DNI, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO, a.TELEFONO, a.APODERADO,
               a.TELAPODERADO, a.FECHAINSCRIPCION, a.FINMENSUALIDAD,
               ROW_NUMBER() OVER (ORDER BY c.NOMBRE, a.NOMBRE) AS ORDEN
        FROM ALUMNA a
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
        WHERE a.ESTADO = 'Activa' AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo);

    ELSEIF p_Tipo = 'retiradas' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT a.NOMBRE AS ALUMNA, a.DNI, c.NOMBRE AS CICLO, a.ESTADO, a.FECHARETIRO, a.MOTIVORETIRO, a.TELAPODERADO,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(a.FECHARETIRO, '%d%m%Y') DESC, a.NOMBRE) AS ORDEN
        FROM ALUMNA a
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        WHERE a.ESTADO IN ('Retirada', 'Inactiva')
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
          AND (v_desde IS NULL OR a.FECHARETIRO IS NULL OR STR_TO_DATE(a.FECHARETIRO, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR a.FECHARETIRO IS NULL OR STR_TO_DATE(a.FECHARETIRO, '%d%m%Y') <= v_hasta);

    ELSEIF p_Tipo = 'cumpleanos' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT a.FECHANACIMIENTO, a.NOMBRE AS ALUMNA,
               TIMESTAMPDIFF(YEAR, STR_TO_DATE(a.FECHANACIMIENTO, '%d%m%Y'), IFNULL(v_hasta, CURDATE())) AS EDAD,
               c.NOMBRE AS CICLO, t.NOMBRE AS TURNO, a.APODERADO, a.TELAPODERADO,
               ROW_NUMBER() OVER (ORDER BY SUBSTRING(a.FECHANACIMIENTO, 3, 2), SUBSTRING(a.FECHANACIMIENTO, 1, 2), a.NOMBRE) AS ORDEN
        FROM ALUMNA a
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
        WHERE a.ESTADO = 'Activa'
          AND STR_TO_DATE(NULLIF(a.FECHANACIMIENTO, ''), '%d%m%Y') IS NOT NULL
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
          AND (v_desde IS NULL OR v_hasta IS NULL
               OR (DATE_FORMAT(v_desde, '%m%d') <= DATE_FORMAT(v_hasta, '%m%d')
                   AND CONCAT(SUBSTRING(a.FECHANACIMIENTO, 3, 2), SUBSTRING(a.FECHANACIMIENTO, 1, 2))
                       BETWEEN DATE_FORMAT(v_desde, '%m%d') AND DATE_FORMAT(v_hasta, '%m%d'))
               OR (DATE_FORMAT(v_desde, '%m%d') > DATE_FORMAT(v_hasta, '%m%d')
                   AND (CONCAT(SUBSTRING(a.FECHANACIMIENTO, 3, 2), SUBSTRING(a.FECHANACIMIENTO, 1, 2)) >= DATE_FORMAT(v_desde, '%m%d')
                        OR CONCAT(SUBSTRING(a.FECHANACIMIENTO, 3, 2), SUBSTRING(a.FECHANACIMIENTO, 1, 2)) <= DATE_FORMAT(v_hasta, '%m%d')))
               OR DATEDIFF(v_hasta, v_desde) >= 365);

    ELSEIF p_Tipo = 'ingresos' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT IFNULL(x.CICLO, 'Sin categoría') AS CICLO,
               SUM(x.PAGOS) AS PAGOS, SUM(x.VENTAS) AS VENTAS, SUM(x.PAGOS + x.VENTAS) AS TOTAL,
               ROW_NUMBER() OVER (ORDER BY SUM(x.PAGOS + x.VENTAS) DESC) AS ORDEN
        FROM (
            SELECT c.NOMBRE AS CICLO, p.MONTO AS PAGOS, 0 AS VENTAS
            FROM PAGO p
            INNER JOIN ALUMNA a ON a.IDALUMNA = p.IDALUMNA
            LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
            WHERE (v_desde IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') >= v_desde)
              AND (v_hasta IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') <= v_hasta)
              AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
            UNION ALL
            SELECT c.NOMBRE AS CICLO, 0 AS PAGOS, v.PRECIO AS VENTAS
            FROM VENTA v
            LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
            LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
            WHERE v.ESTADO_RECIBO = 'Emitido' AND v.ACUENTA IS NULL
              AND NOT EXISTS (SELECT 1 FROM VENTA_ABONO x WHERE x.IDVENTA = v.IDVENTA)
              AND (v_desde IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') >= v_desde)
              AND (v_hasta IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') <= v_hasta)
              AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
            UNION ALL
            SELECT c.NOMBRE AS CICLO, 0 AS PAGOS, ab.MONTO AS VENTAS
            FROM VENTA_ABONO ab
            INNER JOIN VENTA v ON v.IDVENTA = ab.IDVENTA
            LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
            LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
            WHERE v.ESTADO_RECIBO = 'Emitido'
              AND (v_desde IS NULL OR STR_TO_DATE(ab.FECHA, '%d%m%Y') >= v_desde)
              AND (v_hasta IS NULL OR STR_TO_DATE(ab.FECHA, '%d%m%Y') <= v_hasta)
              AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        ) x
        GROUP BY IFNULL(x.CICLO, 'Sin categoría');
    ELSEIF p_Tipo = 'abonos' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT ab.FECHA, ab.IDABONO, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.NOMBRE, v.IDALUMNA,
               c.NOMBRE AS CICLO, v.PRODUCTO, ab.ORIGEN, ab.MONTO, ab.MEDIO,
               GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0) AS SALDO,
               CONCAT(IFNULL(ab.IDUSUARIO, 'sin usuario'), ' – ', fn_fecha_vista(ab.FECHAREGISTRO), ' ', LEFT(IFNULL(ab.HORAREGISTRO, ''), 5)) AS REGISTRADOPOR,
               ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(ab.FECHA, '%d%m%Y'), ab.IDABONO) AS ORDEN
        FROM VENTA_ABONO ab
        INNER JOIN VENTA v ON v.IDVENTA = ab.IDVENTA
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        WHERE v.ESTADO_RECIBO = 'Emitido'
          AND (v_desde IS NULL OR STR_TO_DATE(ab.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(ab.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo);
    ELSEIF p_Tipo = 'asistencias' THEN
        CREATE TEMPORARY TABLE tmp_reporte AS
        SELECT a.IDALUMNA, a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO,
               SUM(s.ESTADO = 'Presente') AS PRESENTES,
               SUM(s.ESTADO <> 'Presente') AS FALTAS,
               COUNT(s.IDASISTENCIA) AS REGISTROS,
               ROUND(100 * SUM(s.ESTADO = 'Presente') / NULLIF(COUNT(s.IDASISTENCIA), 0), 0) AS PORCENTAJE,
               ROW_NUMBER() OVER (ORDER BY t.NOMBRE, a.NOMBRE) AS ORDEN
        FROM ALUMNA a
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
        LEFT JOIN ASISTENCIA s ON s.IDALUMNA = a.IDALUMNA
             AND (v_desde IS NULL OR STR_TO_DATE(s.FECHA, '%d%m%Y') >= v_desde)
             AND (v_hasta IS NULL OR STR_TO_DATE(s.FECHA, '%d%m%Y') <= v_hasta)
        WHERE a.ESTADO = 'Activa'
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        GROUP BY a.IDALUMNA, a.NOMBRE, c.NOMBRE, t.NOMBRE;
    ELSE
        CREATE TEMPORARY TABLE tmp_reporte AS SELECT 1 AS ORDEN LIMIT 0;
    END IF;

    CALL usp_ordenar_temporal('tmp_reporte', p_OrdenarPor, p_Direccion);
    DROP TEMPORARY TABLE IF EXISTS tmp_reporte;
END$$

DELIMITER ;
