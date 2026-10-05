USE `VoleyDB`;

DROP FUNCTION IF EXISTS fn_asiste_dia;
DROP PROCEDURE IF EXISTS usp_asistencia_dia;
DROP PROCEDURE IF EXISTS usp_asistencia_marcar;
DROP PROCEDURE IF EXISTS usp_dashboard_resumen;
DROP PROCEDURE IF EXISTS usp_dashboard_turnos;
DROP PROCEDURE IF EXISTS usp_dashboard_matriculas;
DROP PROCEDURE IF EXISTS usp_venta_detalle_aplicar;
DROP PROCEDURE IF EXISTS usp_venta_detalle_listar;
DROP PROCEDURE IF EXISTS usp_venta_listar;
DROP PROCEDURE IF EXISTS usp_venta_obtener;
DROP PROCEDURE IF EXISTS usp_venta_insertar;
DROP PROCEDURE IF EXISTS usp_venta_actualizar;
DROP PROCEDURE IF EXISTS usp_venta_anular;
DROP PROCEDURE IF EXISTS usp_venta_recibos;
DROP PROCEDURE IF EXISTS usp_venta_eliminar;
DROP PROCEDURE IF EXISTS usp_egreso_listar;
DROP PROCEDURE IF EXISTS usp_egreso_obtener;
DROP PROCEDURE IF EXISTS usp_egreso_insertar;
DROP PROCEDURE IF EXISTS usp_egreso_actualizar;
DROP PROCEDURE IF EXISTS usp_egreso_eliminar;
DROP PROCEDURE IF EXISTS usp_auditoria_listar;
DROP PROCEDURE IF EXISTS usp_auditoria_insertar;

DELIMITER $$

-- 1 si p_Dias ("LUNES, MIÉRCOLES, ...") incluye el día de la semana de p_Fecha. Sin días: 1.
-- La collation de la base ignora tildes y mayúsculas.
CREATE FUNCTION fn_asiste_dia(p_Dias VARCHAR(120), p_Fecha CHAR(8)) RETURNS TINYINT
DETERMINISTIC
BEGIN
    IF TRIM(IFNULL(p_Dias, '')) = '' THEN
        RETURN 1;
    END IF;
    RETURN CONCAT(',', REPLACE(p_Dias, ' ', ''), ',')
           LIKE CONCAT('%,', ELT(WEEKDAY(STR_TO_DATE(p_Fecha, '%d%m%Y')) + 1,
                                 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'), ',%');
END$$

-- Los días de la alumna son los suyos o, si no tiene, los de su turno (LETOCA).
-- Sin búsqueda: alumnas del turno a las que les toca ese día (todas con p_Todas = 1) y las ya marcadas;
-- las recuperaciones marcadas salen en cualquier turno.
-- Con búsqueda (desde 3 letras): cualquier alumna activa de cualquier turno, para registrar recuperaciones.
CREATE PROCEDURE usp_asistencia_dia(
    IN p_Fecha CHAR(8), IN p_IdTurno VARCHAR(50), IN p_Buscar VARCHAR(100), IN p_Todas TINYINT
)
BEGIN
    DECLARE v_buscar VARCHAR(100);
    SET v_buscar = TRIM(IFNULL(p_Buscar, ''));
    SELECT x.IDALUMNA, x.NOMBRE, x.ESTADO, x.IDASISTENCIA, x.TURNO, x.DIAS, x.LETOCA
    FROM (
        SELECT a.IDALUMNA, a.NOMBRE, IFNULL(s.ESTADO, '') AS ESTADO, s.IDASISTENCIA,
               a.IDTURNO, t.NOMBRE AS TURNO,
               IFNULL(NULLIF(a.DIASASISTENCIA, ''), t.DIASACTIVOS) AS DIAS,
               fn_asiste_dia(IFNULL(NULLIF(a.DIASASISTENCIA, ''), t.DIASACTIVOS), p_Fecha) AS LETOCA
        FROM ALUMNA a
        LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
        LEFT JOIN ASISTENCIA s ON s.IDALUMNA = a.IDALUMNA AND s.FECHA = p_Fecha
        WHERE a.ESTADO = 'Activa'
    ) x
    WHERE IF(CHAR_LENGTH(v_buscar) >= 3,
             x.NOMBRE LIKE CONCAT('%', v_buscar, '%'),
             ((IFNULL(p_IdTurno, '') = '' OR x.IDTURNO = p_IdTurno)
              AND (IFNULL(p_Todas, 0) = 1 OR x.LETOCA = 1 OR x.IDASISTENCIA IS NOT NULL))
             OR (x.IDASISTENCIA IS NOT NULL AND x.LETOCA = 0)
          )
    ORDER BY x.NOMBRE;
END$$

CREATE PROCEDURE usp_asistencia_marcar(
    IN p_IdAlumna VARCHAR(50), IN p_Fecha CHAR(8), IN p_Estado VARCHAR(20),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    IF p_Estado NOT IN ('Presente', 'Ausente', 'Tarde') THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Estado de asistencia no válido.'; LEAVE proc;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM ALUMNA WHERE IDALUMNA = p_IdAlumna) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La alumna no existe.'; LEAVE proc;
    END IF;
    IF EXISTS (SELECT 1 FROM ASISTENCIA WHERE IDALUMNA = p_IdAlumna AND FECHA = p_Fecha) THEN
        UPDATE ASISTENCIA SET ESTADO = p_Estado WHERE IDALUMNA = p_IdAlumna AND FECHA = p_Fecha;
    ELSE
        SELECT CONCAT('ASI', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDASISTENCIA, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
          INTO v_id FROM ASISTENCIA;
        INSERT INTO ASISTENCIA (IDASISTENCIA, IDALUMNA, FECHA, ESTADO, FECHACREACION)
        VALUES (v_id, p_IdAlumna, p_Fecha, p_Estado, DATE_FORMAT(NOW(), '%d%m%Y'));
    END IF;
    SET p_Resultado = 1; SET p_Mensaje = 'Asistencia registrada.';
END$$

CREATE PROCEDURE usp_dashboard_resumen()
BEGIN
    SELECT
        (SELECT COUNT(*) FROM ALUMNA WHERE ESTADO = 'Activa') AS ALUMNASACTIVAS,
        (SELECT COUNT(*) FROM ALUMNA WHERE ESTADO = 'Retirada') AS ALUMNASRETIRADAS,
        (SELECT COUNT(*) FROM ALUMNA
          WHERE FECHAINSCRIPCION = DATE_FORMAT(NOW(), '%d%m%Y')) AS MATRICULASHOY,
        (SELECT IFNULL(SUM(MONTO), 0) FROM PAGO
          WHERE SUBSTRING(FECHA, 3, 2) = DATE_FORMAT(NOW(), '%m')
            AND SUBSTRING(FECHA, 5, 4) = DATE_FORMAT(NOW(), '%Y')) AS PAGOSMES,
        (SELECT IFNULL(SUM(PRECIO), 0) FROM VENTA
          WHERE SUBSTRING(FECHA, 3, 2) = DATE_FORMAT(NOW(), '%m')
            AND SUBSTRING(FECHA, 5, 4) = DATE_FORMAT(NOW(), '%Y')) AS VENTASMES,
        (SELECT IFNULL(SUM(MONTO), 0) FROM EGRESO
          WHERE SUBSTRING(FECHA, 3, 2) = DATE_FORMAT(NOW(), '%m')
            AND SUBSTRING(FECHA, 5, 4) = DATE_FORMAT(NOW(), '%Y')) AS EGRESOSMES,
        (SELECT COUNT(*) FROM ASISTENCIA
          WHERE ESTADO = 'Presente'
            AND SUBSTRING(FECHA, 3, 2) = DATE_FORMAT(NOW(), '%m')
            AND SUBSTRING(FECHA, 5, 4) = DATE_FORMAT(NOW(), '%Y')) AS ASISTENCIASMES;
END$$

CREATE PROCEDURE usp_dashboard_turnos()
BEGIN
    SELECT t.NOMBRE, t.HORAINICIO, t.HORAFIN,
           COUNT(DISTINCT IF(a.ESTADO = 'Activa', a.IDALUMNA, NULL)) AS ALUMNAS,
           COUNT(s.IDASISTENCIA) AS PRESENTES
    FROM TURNO t
    LEFT JOIN ALUMNA a ON a.IDTURNO = t.IDTURNO
    LEFT JOIN ASISTENCIA s ON s.IDALUMNA = a.IDALUMNA
        AND s.ESTADO = 'Presente'
        AND SUBSTRING(s.FECHA, 3, 2) = DATE_FORMAT(NOW(), '%m')
        AND SUBSTRING(s.FECHA, 5, 4) = DATE_FORMAT(NOW(), '%Y')
    WHERE t.ACTIVO = 1
    GROUP BY t.IDTURNO, t.NOMBRE, t.HORAINICIO, t.HORAFIN
    ORDER BY t.HORAINICIO, t.NOMBRE;
END$$

-- Matrícula nueva: alumna inscrita en el periodo.
-- Mensualidad: mensualidad iniciada en el periodo que no es la primera de una alumna inscrita en ese periodo.
CREATE PROCEDURE usp_dashboard_matriculas(IN p_Desde CHAR(8), IN p_Hasta CHAR(8))
BEGIN
    DECLARE v_Desde DATE DEFAULT STR_TO_DATE(p_Desde, '%d%m%Y');
    DECLARE v_Hasta DATE DEFAULT STR_TO_DATE(p_Hasta, '%d%m%Y');

    SELECT * FROM (
        SELECT 'Matrícula nueva' AS TIPO,
               a.FECHAINSCRIPCION AS FECHA,
               a.IDALUMNA, a.NOMBRE, a.ESTADO,
               t.NOMBRE AS TURNO,
               IFNULL((SELECT m.MONTO FROM MENSUALIDAD m
                        WHERE m.IDALUMNA = a.IDALUMNA
                        ORDER BY STR_TO_DATE(m.FECHAINICIO, '%d%m%Y'), m.IDMENSUALIDAD
                        LIMIT 1), a.MENSUALIDAD) AS MONTO
        FROM ALUMNA a
        LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
        WHERE STR_TO_DATE(NULLIF(a.FECHAINSCRIPCION, ''), '%d%m%Y') BETWEEN v_Desde AND v_Hasta

        UNION ALL

        SELECT 'Mensualidad' AS TIPO,
               m.FECHAINICIO AS FECHA,
               a.IDALUMNA, a.NOMBRE, a.ESTADO,
               t.NOMBRE AS TURNO,
               m.MONTO
        FROM MENSUALIDAD m
        JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
        LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
        WHERE STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') BETWEEN v_Desde AND v_Hasta
          AND NOT (
              STR_TO_DATE(NULLIF(a.FECHAINSCRIPCION, ''), '%d%m%Y') BETWEEN v_Desde AND v_Hasta
              AND NOT EXISTS (
                  SELECT 1 FROM MENSUALIDAD p
                  WHERE p.IDALUMNA = m.IDALUMNA
                    AND (STR_TO_DATE(p.FECHAINICIO, '%d%m%Y') < STR_TO_DATE(m.FECHAINICIO, '%d%m%Y')
                         OR (p.FECHAINICIO = m.FECHAINICIO AND p.IDMENSUALIDAD < m.IDMENSUALIDAD))
              )
          )
    ) r
    ORDER BY STR_TO_DATE(r.FECHA, '%d%m%Y') DESC, r.TIPO, r.NOMBRE;
END$$

CREATE PROCEDURE usp_venta_detalle_aplicar(IN p_Id VARCHAR(50), IN p_Lineas TEXT, OUT p_Cantidad INT)
proc: BEGIN
    DECLARE v_rest TEXT;
    DECLARE v_item VARCHAR(400);
    DECLARE v_prod VARCHAR(150);
    DECLARE v_precio_txt VARCHAR(30);
    DECLARE v_talla VARCHAR(20);
    DECLARE v_orden INT DEFAULT 0;
    DECLARE v_base INT;
    DECLARE v_nombres VARCHAR(500);
    DECLARE v_suma DECIMAL(10,2);
    DECLARE v_dist INT;
    DECLARE v_talla_unica VARCHAR(5);

    DROP TEMPORARY TABLE IF EXISTS tmp_venta_lin;
    CREATE TEMPORARY TABLE tmp_venta_lin (
        ORDEN INT NOT NULL,
        PRODUCTO VARCHAR(150) NOT NULL,
        TALLA VARCHAR(5) NULL,
        PRECIO DECIMAL(10,2) NOT NULL
    );

    SET v_rest = IFNULL(p_Lineas, '');
    WHILE CHAR_LENGTH(TRIM(v_rest)) > 0 DO
        SET v_item = SUBSTRING_INDEX(v_rest, ';;', 1);
        IF LOCATE(';;', v_rest) > 0 THEN
            SET v_rest = SUBSTRING(v_rest, CHAR_LENGTH(v_item) + 3);
        ELSE
            SET v_rest = '';
        END IF;
        SET v_prod = NULLIF(TRIM(SUBSTRING_INDEX(v_item, '||', 1)), '');
        SET v_precio_txt = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(v_item, '||', 2), '||', -1));
        SET v_talla = NULLIF(TRIM(SUBSTRING_INDEX(v_item, '||', -1)), '');
        IF v_talla = v_prod OR v_talla = v_precio_txt THEN
            SET v_talla = NULL;
        END IF;
        IF v_prod IS NOT NULL THEN
            SET v_orden = v_orden + 1;
            INSERT INTO tmp_venta_lin (ORDEN, PRODUCTO, TALLA, PRECIO)
            VALUES (
                v_orden,
                LEFT(v_prod, 150),
                NULLIF(LEFT(IFNULL(v_talla, ''), 5), ''),
                IFNULL(CAST(NULLIF(v_precio_txt, '') AS DECIMAL(10,2)), 0)
            );
        END IF;
    END WHILE;

    SET p_Cantidad = v_orden;
    IF v_orden < 1 THEN
        LEAVE proc;
    END IF;

    SELECT IFNULL(MAX(CAST(SUBSTRING(IDDETALLE, 4) AS UNSIGNED)), 0) INTO v_base FROM VENTA_DETALLE;
    DELETE FROM VENTA_DETALLE WHERE IDVENTA = p_Id;
    INSERT INTO VENTA_DETALLE (IDDETALLE, IDVENTA, ORDEN, PRODUCTO, TALLA, PRECIO)
    SELECT CONCAT('DET', LPAD(v_base + ORDEN, 6, '0')), p_Id, ORDEN, PRODUCTO, NULLIF(TALLA, ''), PRECIO
    FROM tmp_venta_lin;
    SELECT IFNULL(GROUP_CONCAT(PRODUCTO ORDER BY ORDEN SEPARATOR ', '), ''), IFNULL(SUM(PRECIO), 0)
      INTO v_nombres, v_suma
      FROM tmp_venta_lin;
    SELECT COUNT(DISTINCT TALLA), MIN(TALLA)
      INTO v_dist, v_talla_unica
      FROM tmp_venta_lin
     WHERE TALLA IS NOT NULL AND TALLA <> '';
    UPDATE VENTA
       SET PRODUCTO = NULLIF(LEFT(v_nombres, 500), ''),
           PRECIO = v_suma,
           TALLA = IF(v_dist = 1, v_talla_unica, NULL)
     WHERE IDVENTA = p_Id;
END$$

CREATE PROCEDURE usp_venta_detalle_listar(IN p_Id VARCHAR(50))
BEGIN
    SELECT IDDETALLE, IDVENTA, ORDEN, PRODUCTO, TALLA, PRECIO
    FROM VENTA_DETALLE
    WHERE IDVENTA = p_Id
    ORDER BY ORDEN, IDDETALLE;
END$$

-- p_Saldo: 'Con saldo' (pago parcial pendiente) o 'Pagado'.
CREATE PROCEDURE usp_venta_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_Desde CHAR(8), IN p_Hasta CHAR(8),
    IN p_IdCiclo VARCHAR(50), IN p_Tipo VARCHAR(30), IN p_Producto VARCHAR(150), IN p_Saldo VARCHAR(20),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4),
    IN p_Pagina INT, IN p_Tamanio INT, OUT p_Total INT
)
BEGIN
    DECLARE v_off INT DEFAULT 0;
    IF p_Pagina IS NULL OR p_Pagina < 1 THEN SET p_Pagina = 1; END IF;
    IF p_Tamanio IS NULL OR p_Tamanio < 1 THEN SET p_Tamanio = 10; END IF;
    SET v_off = (p_Pagina - 1) * p_Tamanio;

    DROP TEMPORARY TABLE IF EXISTS tmp_venta_lista;
    CREATE TEMPORARY TABLE tmp_venta_lista AS
    SELECT v.IDVENTA, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.NOMBRE, v.IDALUMNA, c.NOMBRE AS CICLO,
           v.TIPO, v.PRODUCTO, v.COMPROBANTE, v.ESTADO_RECIBO, t.NOMBRE AS TURNO, v.TALLA, v.PRECIO, v.MEDIO, v.FECHA,
           IFNULL(v.ACUENTA, v.PRECIO) AS PAGADO,
           IF(v.ESTADO_RECIBO = 'Emitido', GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0), 0) AS SALDO,
           (SELECT COUNT(*) FROM VENTA_ABONO ab WHERE ab.IDVENTA = v.IDVENTA) AS ABONOS,
           v.USUARIO_EMISION, v.FECHA_EMISION, v.HORA_EMISION,
           v.USUARIO_MODIFICACION, v.FECHA_MODIFICACION, v.HORA_MODIFICACION,
           v.USUARIO_ANULACION, v.FECHA_ANULACION, v.HORA_ANULACION,
           v.USUARIO_ELIMINACION, v.FECHA_ELIMINACION, v.HORA_ELIMINACION
    FROM VENTA v
    LEFT JOIN TURNO t ON t.IDTURNO = v.IDTURNO
    LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR v.NOMBRE LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(v.PRODUCTO, '') LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(v.COMPROBANTE, v.IDVENTA) LIKE CONCAT('%', p_Buscar, '%')
           OR v.IDVENTA LIKE CONCAT('%', p_Buscar, '%')
           OR EXISTS (
                SELECT 1 FROM VENTA_DETALLE d
                WHERE d.IDVENTA = v.IDVENTA AND d.PRODUCTO LIKE CONCAT('%', p_Buscar, '%')
           ))
      AND (p_Estado IS NULL OR p_Estado = '' OR v.ESTADO_RECIBO = p_Estado)
      AND (p_Estado = 'Eliminado' OR IFNULL(v.ESTADO_RECIBO, 'Emitido') <> 'Eliminado')
      AND (p_Desde IS NULL OR p_Desde = '' OR STR_TO_DATE(NULLIF(v.FECHA, ''), '%d%m%Y') >= STR_TO_DATE(p_Desde, '%d%m%Y'))
      AND (p_Hasta IS NULL OR p_Hasta = '' OR STR_TO_DATE(NULLIF(v.FECHA, ''), '%d%m%Y') <= STR_TO_DATE(p_Hasta, '%d%m%Y'))
      AND (p_IdCiclo IS NULL OR p_IdCiclo = '' OR a.IDCICLO = p_IdCiclo)
      AND (p_Tipo IS NULL OR p_Tipo = '' OR v.TIPO = p_Tipo)
      AND (p_Producto IS NULL OR p_Producto = ''
           OR IFNULL(v.PRODUCTO, '') LIKE CONCAT('%', p_Producto, '%')
           OR EXISTS (SELECT 1 FROM VENTA_DETALLE d
                      WHERE d.IDVENTA = v.IDVENTA AND d.PRODUCTO LIKE CONCAT('%', p_Producto, '%')))
      AND (p_Saldo IS NULL OR p_Saldo = ''
           OR (p_Saldo = 'Con saldo' AND v.ESTADO_RECIBO = 'Emitido' AND v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO) > 0)
           OR (p_Saldo = 'Pagado' AND v.ESTADO_RECIBO = 'Emitido' AND v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO) <= 0));

    SELECT COUNT(*) INTO p_Total FROM tmp_venta_lista;
    SELECT * FROM tmp_venta_lista
    ORDER BY STR_TO_DATE(NULLIF(FECHA, ''), '%d%m%Y') DESC, IDVENTA DESC
    LIMIT v_off, p_Tamanio;
    DROP TEMPORARY TABLE IF EXISTS tmp_venta_lista;
END$$

CREATE PROCEDURE usp_venta_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT IDVENTA, IFNULL(COMPROBANTE, IDVENTA) AS NUMERO, NOMBRE, IDALUMNA, TIPO, PRODUCTO, COMPROBANTE, ESTADO_RECIBO,
           IDTURNO, TALLA, OBSERVACION, PRECIO, MEDIO, FECHA, ACUENTA,
           IFNULL(ACUENTA, PRECIO) AS PAGADO,
           IF(ESTADO_RECIBO = 'Emitido', GREATEST(PRECIO - IFNULL(ACUENTA, PRECIO), 0), 0) AS SALDO,
           USUARIO_EMISION, FECHA_EMISION, HORA_EMISION,
           USUARIO_MODIFICACION, FECHA_MODIFICACION, HORA_MODIFICACION,
           USUARIO_ANULACION, FECHA_ANULACION, HORA_ANULACION,
           USUARIO_ELIMINACION, FECHA_ELIMINACION, HORA_ELIMINACION
    FROM VENTA WHERE IDVENTA = p_Id;
END$$

CREATE PROCEDURE usp_venta_insertar(
    IN p_Nombre VARCHAR(200), IN p_Producto VARCHAR(150), IN p_Tipo VARCHAR(30), IN p_IdTurno VARCHAR(50),
    IN p_Talla VARCHAR(5), IN p_Obs VARCHAR(500), IN p_Precio DECIMAL(10,2), IN p_Medio VARCHAR(30),
    IN p_Fecha CHAR(8), IN p_Lineas TEXT, IN p_ACuenta DECIMAL(10,2), IN p_Usuario VARCHAR(50),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    DECLARE v_tipo VARCHAR(30);
    DECLARE v_cmp VARCHAR(30);
    DECLARE v_lineas INT DEFAULT 0;
    DECLARE v_usuario VARCHAR(50);
    SET v_tipo = IF(p_Tipo = 'Servicio', 'Servicio', 'Producto físico');
    SET v_usuario = NULLIF(TRIM(IFNULL(p_Usuario, '')), '');
    IF p_Nombre IS NULL OR TRIM(p_Nombre) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el nombre.'; LEAVE proc;
    END IF;
    IF p_IdTurno IS NULL OR NOT EXISTS (SELECT 1 FROM TURNO WHERE IDTURNO = p_IdTurno) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Selecciona un turno.'; LEAVE proc;
    END IF;
    IF v_tipo = 'Servicio' THEN
        SELECT CONCAT('CMP', LPAD(IFNULL(MAX(CAST(SUBSTRING(COMPROBANTE, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
          INTO v_cmp FROM VENTA WHERE COMPROBANTE LIKE 'CMP%';
    END IF;
    SELECT CONCAT('VEN', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDVENTA, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM VENTA;
    INSERT INTO VENTA (
        IDVENTA, NOMBRE, PRODUCTO, TIPO, COMPROBANTE, IDTURNO, TALLA, OBSERVACION, PRECIO, MEDIO, FECHA,
        ESTADO_RECIBO, USUARIO_EMISION, FECHA_EMISION, HORA_EMISION
    )
    VALUES (v_id, TRIM(p_Nombre), NULL, v_tipo, v_cmp, p_IdTurno, NULL, p_Obs, 0,
            IFNULL(NULLIF(p_Medio, ''), 'Efectivo'), IFNULL(p_Fecha, DATE_FORMAT(NOW(), '%d%m%Y')),
            'Emitido', v_usuario, DATE_FORMAT(NOW(), '%d%m%Y'), DATE_FORMAT(NOW(), '%H:%i:%s'));
    CALL usp_venta_detalle_aplicar(v_id, p_Lineas, v_lineas);
    IF v_lineas < 1 THEN
        DELETE FROM VENTA WHERE IDVENTA = v_id;
        SET p_Resultado = 0; SET p_Mensaje = 'Selecciona cada artículo y su importe.'; LEAVE proc;
    END IF;
    UPDATE VENTA
       SET IDALUMNA = (SELECT a.IDALUMNA FROM ALUMNA a WHERE a.NOMBRE = TRIM(p_Nombre)
                       ORDER BY a.ESTADO = 'Activa' DESC, a.IDALUMNA LIMIT 1),
           ACUENTA = IF(p_ACuenta IS NULL OR p_ACuenta < 0, NULL, LEAST(p_ACuenta, PRECIO))
     WHERE IDVENTA = v_id;
    CALL usp_venta_abono_sincronizar(v_id, v_usuario);
    SET p_Resultado = 1;
    IF v_tipo = 'Servicio' THEN
        SET p_Mensaje = CONCAT('Comprobante ', v_cmp, ' emitido. No se creó ni modificó ninguna mensualidad.');
    ELSE
        SET p_Mensaje = 'Venta registrada.';
    END IF;
END$$

CREATE PROCEDURE usp_venta_actualizar(
    IN p_Id VARCHAR(50), IN p_Nombre VARCHAR(200), IN p_Producto VARCHAR(150), IN p_Tipo VARCHAR(30),
    IN p_IdTurno VARCHAR(50), IN p_Talla VARCHAR(5), IN p_Obs VARCHAR(500), IN p_Precio DECIMAL(10,2),
    IN p_Medio VARCHAR(30), IN p_Fecha CHAR(8), IN p_Lineas TEXT, IN p_ACuenta DECIMAL(10,2), IN p_Usuario VARCHAR(50),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_tipo VARCHAR(30);
    DECLARE v_cmp VARCHAR(30);
    DECLARE v_lineas INT DEFAULT 0;
    DECLARE v_estado VARCHAR(20);
    DECLARE v_usuario VARCHAR(50);
    SET v_tipo = IF(p_Tipo = 'Servicio', 'Servicio', 'Producto físico');
    SET v_usuario = NULLIF(TRIM(IFNULL(p_Usuario, '')), '');
    IF p_Nombre IS NULL OR TRIM(p_Nombre) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el nombre.'; LEAVE proc;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM VENTA WHERE IDVENTA = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'No se encontró la venta.'; LEAVE proc;
    END IF;
    SELECT ESTADO_RECIBO INTO v_estado FROM VENTA WHERE IDVENTA = p_Id;
    IF v_estado <> 'Emitido' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Un recibo anulado o eliminado no se modifica.'; LEAVE proc;
    END IF;
    CALL usp_venta_detalle_aplicar(p_Id, p_Lineas, v_lineas);
    IF v_lineas < 1 THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Selecciona cada artículo y su importe.'; LEAVE proc;
    END IF;
    SELECT COMPROBANTE INTO v_cmp FROM VENTA WHERE IDVENTA = p_Id;
    IF v_tipo = 'Servicio' AND (v_cmp IS NULL OR v_cmp = '') THEN
        SELECT CONCAT('CMP', LPAD(IFNULL(MAX(CAST(SUBSTRING(COMPROBANTE, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
          INTO v_cmp FROM VENTA WHERE COMPROBANTE LIKE 'CMP%';
    END IF;
    IF v_tipo <> 'Servicio' THEN
        SET v_cmp = NULL;
    END IF;
    UPDATE VENTA
       SET NOMBRE = TRIM(p_Nombre), TIPO = v_tipo, COMPROBANTE = v_cmp,
           IDTURNO = p_IdTurno, OBSERVACION = p_Obs,
           MEDIO = IFNULL(NULLIF(p_Medio, ''), 'Efectivo'), FECHA = p_Fecha,
           IDALUMNA = (SELECT a.IDALUMNA FROM ALUMNA a WHERE a.NOMBRE = TRIM(p_Nombre)
                       ORDER BY a.ESTADO = 'Activa' DESC, a.IDALUMNA LIMIT 1),
           ACUENTA = IF(EXISTS (SELECT 1 FROM VENTA_ABONO ab WHERE ab.IDVENTA = p_Id AND ab.ORIGEN = 'Abono'),
                        LEAST(IFNULL(ACUENTA, PRECIO), PRECIO),
                        IF(p_ACuenta IS NULL OR p_ACuenta < 0, NULL, LEAST(p_ACuenta, PRECIO))),
           USUARIO_MODIFICACION = v_usuario,
           FECHA_MODIFICACION = DATE_FORMAT(NOW(), '%d%m%Y'),
           HORA_MODIFICACION = DATE_FORMAT(NOW(), '%H:%i:%s')
     WHERE IDVENTA = p_Id;
    CALL usp_venta_abono_sincronizar(p_Id, v_usuario);
    SET p_Resultado = 1;
    IF v_tipo = 'Servicio' THEN
        SET p_Mensaje = CONCAT('Comprobante ', v_cmp, ' actualizado. No se modificó ninguna mensualidad.');
    ELSE
        SET p_Mensaje = 'Venta actualizada.';
    END IF;
END$$

CREATE PROCEDURE usp_venta_anular(
    IN p_Id VARCHAR(50), IN p_Usuario VARCHAR(50),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_numero VARCHAR(30);
    DECLARE v_usuario VARCHAR(50);
    IF NOT EXISTS (SELECT 1 FROM VENTA WHERE IDVENTA = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'No se encontró la venta.'; LEAVE proc;
    END IF;
    SELECT ESTADO_RECIBO, IFNULL(COMPROBANTE, IDVENTA) INTO v_estado, v_numero FROM VENTA WHERE IDVENTA = p_Id;
    IF v_estado <> 'Emitido' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Este recibo ya no se puede anular.'; LEAVE proc;
    END IF;
    SET v_usuario = NULLIF(TRIM(IFNULL(p_Usuario, '')), '');
    UPDATE VENTA
       SET ESTADO_RECIBO = 'Anulado',
           USUARIO_ANULACION = v_usuario,
           FECHA_ANULACION = DATE_FORMAT(NOW(), '%d%m%Y'),
           HORA_ANULACION = DATE_FORMAT(NOW(), '%H:%i:%s')
     WHERE IDVENTA = p_Id;
    SET p_Resultado = 1;
    SET p_Mensaje = CONCAT('Recibo ', v_numero, ' anulado. El número se conserva.');
END$$

CREATE PROCEDURE usp_venta_eliminar(
    IN p_Id VARCHAR(50), IN p_Usuario VARCHAR(50),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_numero VARCHAR(30);
    DECLARE v_usuario VARCHAR(50);
    IF NOT EXISTS (SELECT 1 FROM VENTA WHERE IDVENTA = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'No se encontró la venta.'; LEAVE proc;
    END IF;
    SELECT ESTADO_RECIBO, IFNULL(COMPROBANTE, IDVENTA) INTO v_estado, v_numero FROM VENTA WHERE IDVENTA = p_Id;
    IF v_estado = 'Eliminado' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Este recibo ya está eliminado.'; LEAVE proc;
    END IF;
    SET v_usuario = NULLIF(TRIM(IFNULL(p_Usuario, '')), '');
    UPDATE VENTA
       SET ESTADO_RECIBO = 'Eliminado',
           USUARIO_ELIMINACION = v_usuario,
           FECHA_ELIMINACION = DATE_FORMAT(NOW(), '%d%m%Y'),
           HORA_ELIMINACION = DATE_FORMAT(NOW(), '%H:%i:%s')
     WHERE IDVENTA = p_Id;
    SET p_Resultado = 1;
    SET p_Mensaje = CONCAT('Recibo ', v_numero, ' eliminado. El número no se vuelve a usar.');
END$$

CREATE PROCEDURE usp_venta_recibos()
BEGIN
    SELECT IDVENTA, IFNULL(COMPROBANTE, IDVENTA) AS NUMERO, COMPROBANTE, ESTADO_RECIBO, NOMBRE, PRECIO,
           USUARIO_EMISION, FECHA_EMISION, HORA_EMISION,
           USUARIO_MODIFICACION, FECHA_MODIFICACION, HORA_MODIFICACION,
           USUARIO_ANULACION, FECHA_ANULACION, HORA_ANULACION,
           USUARIO_ELIMINACION, FECHA_ELIMINACION, HORA_ELIMINACION
    FROM VENTA
    ORDER BY IDVENTA;
END$$

-- p_Estado filtra por medio de pago.
CREATE PROCEDURE usp_egreso_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_Desde CHAR(8), IN p_Hasta CHAR(8),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4),
    IN p_Pagina INT, IN p_Tamanio INT, OUT p_Total INT
)
BEGIN
    DECLARE v_off INT DEFAULT 0;
    DECLARE v_desde DATE;
    DECLARE v_hasta DATE;
    IF p_Pagina IS NULL OR p_Pagina < 1 THEN SET p_Pagina = 1; END IF;
    IF p_Tamanio IS NULL OR p_Tamanio < 1 THEN SET p_Tamanio = 10; END IF;
    SET v_off = (p_Pagina - 1) * p_Tamanio;
    SET v_desde = STR_TO_DATE(NULLIF(p_Desde, ''), '%d%m%Y');
    SET v_hasta = STR_TO_DATE(NULLIF(p_Hasta, ''), '%d%m%Y');
    SELECT COUNT(*) INTO p_Total FROM EGRESO e
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR e.CONCEPTO LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(e.PROVEEDOR, '') LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR e.MEDIO = p_Estado)
      AND (v_desde IS NULL OR STR_TO_DATE(e.FECHA, '%d%m%Y') >= v_desde)
      AND (v_hasta IS NULL OR STR_TO_DATE(e.FECHA, '%d%m%Y') <= v_hasta);
    SELECT IDEGRESO, FECHA, CONCEPTO, PROVEEDOR, MONTO, MEDIO
    FROM EGRESO e
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR e.CONCEPTO LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(e.PROVEEDOR, '') LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR e.MEDIO = p_Estado)
      AND (v_desde IS NULL OR STR_TO_DATE(e.FECHA, '%d%m%Y') >= v_desde)
      AND (v_hasta IS NULL OR STR_TO_DATE(e.FECHA, '%d%m%Y') <= v_hasta)
    ORDER BY STR_TO_DATE(e.FECHA, '%d%m%Y') DESC, IDEGRESO DESC
    LIMIT v_off, p_Tamanio;
END$$

CREATE PROCEDURE usp_egreso_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT IDEGRESO, FECHA, CONCEPTO, PROVEEDOR, MONTO, MEDIO, OBSERVACIONES
    FROM EGRESO WHERE IDEGRESO = p_Id;
END$$

CREATE PROCEDURE usp_egreso_insertar(
    IN p_Fecha CHAR(8), IN p_Concepto VARCHAR(200), IN p_Proveedor VARCHAR(200),
    IN p_Monto DECIMAL(10,2), IN p_Medio VARCHAR(30), IN p_Obs VARCHAR(500),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    IF p_Concepto IS NULL OR TRIM(p_Concepto) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el concepto.'; LEAVE proc;
    END IF;
    IF p_Monto IS NULL OR p_Monto < 0 THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el monto.'; LEAVE proc;
    END IF;
    SELECT CONCAT('EGR', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDEGRESO, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM EGRESO;
    INSERT INTO EGRESO (IDEGRESO, FECHA, CONCEPTO, PROVEEDOR, MONTO, MEDIO, OBSERVACIONES, FECHACREACION)
    VALUES (v_id, IFNULL(p_Fecha, DATE_FORMAT(NOW(), '%d%m%Y')), TRIM(p_Concepto), p_Proveedor, p_Monto,
            IFNULL(NULLIF(p_Medio, ''), 'Efectivo'), p_Obs, DATE_FORMAT(NOW(), '%d%m%Y'));
    SET p_Resultado = 1; SET p_Mensaje = 'Egreso registrado.';
END$$

CREATE PROCEDURE usp_egreso_actualizar(
    IN p_Id VARCHAR(50), IN p_Fecha CHAR(8), IN p_Concepto VARCHAR(200), IN p_Proveedor VARCHAR(200),
    IN p_Monto DECIMAL(10,2), IN p_Medio VARCHAR(30), IN p_Obs VARCHAR(500),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    UPDATE EGRESO
       SET FECHA = p_Fecha, CONCEPTO = TRIM(p_Concepto), PROVEEDOR = p_Proveedor,
           MONTO = p_Monto, MEDIO = IFNULL(NULLIF(p_Medio, ''), 'Efectivo'), OBSERVACIONES = p_Obs
     WHERE IDEGRESO = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Egreso actualizado.';
END$$

CREATE PROCEDURE usp_egreso_eliminar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
BEGIN
    DELETE FROM EGRESO WHERE IDEGRESO = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Egreso eliminado.';
END$$

DELIMITER ;
