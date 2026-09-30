USE `VoleyDB`;

DROP PROCEDURE IF EXISTS usp_asistencia_dia;
DROP PROCEDURE IF EXISTS usp_asistencia_marcar;
DROP PROCEDURE IF EXISTS usp_dashboard_resumen;
DROP PROCEDURE IF EXISTS usp_dashboard_turnos;
DROP PROCEDURE IF EXISTS usp_venta_listar;
DROP PROCEDURE IF EXISTS usp_venta_obtener;
DROP PROCEDURE IF EXISTS usp_venta_insertar;
DROP PROCEDURE IF EXISTS usp_venta_actualizar;
DROP PROCEDURE IF EXISTS usp_venta_eliminar;
DROP PROCEDURE IF EXISTS usp_egreso_listar;
DROP PROCEDURE IF EXISTS usp_egreso_obtener;
DROP PROCEDURE IF EXISTS usp_egreso_insertar;
DROP PROCEDURE IF EXISTS usp_egreso_actualizar;
DROP PROCEDURE IF EXISTS usp_egreso_eliminar;
DROP PROCEDURE IF EXISTS usp_auditoria_listar;
DROP PROCEDURE IF EXISTS usp_auditoria_insertar;

DELIMITER $$

CREATE PROCEDURE usp_asistencia_dia(IN p_Fecha CHAR(8), IN p_IdTurno VARCHAR(50))
BEGIN
    SELECT a.IDALUMNA, a.NOMBRE, IFNULL(s.ESTADO, '') AS ESTADO, s.IDASISTENCIA,
           t.NOMBRE AS TURNO
    FROM ALUMNA a
    LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
    LEFT JOIN ASISTENCIA s ON s.IDALUMNA = a.IDALUMNA AND s.FECHA = p_Fecha
    WHERE a.ESTADO = 'Activa'
      AND (p_IdTurno IS NULL OR p_IdTurno = '' OR a.IDTURNO = p_IdTurno)
    ORDER BY a.NOMBRE;
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
    SELECT t.NOMBRE,
           COUNT(s.IDASISTENCIA) AS PRESENTES
    FROM TURNO t
    LEFT JOIN ALUMNA a ON a.IDTURNO = t.IDTURNO
    LEFT JOIN ASISTENCIA s ON s.IDALUMNA = a.IDALUMNA
        AND s.ESTADO = 'Presente'
        AND SUBSTRING(s.FECHA, 3, 2) = DATE_FORMAT(NOW(), '%m')
        AND SUBSTRING(s.FECHA, 5, 4) = DATE_FORMAT(NOW(), '%Y')
    WHERE t.ACTIVO = 1
    GROUP BY t.IDTURNO, t.NOMBRE
    ORDER BY t.HORAINICIO, t.NOMBRE;
END$$

CREATE PROCEDURE usp_venta_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4),
    IN p_Pagina INT, IN p_Tamanio INT, OUT p_Total INT
)
BEGIN
    DECLARE v_off INT DEFAULT 0;
    IF p_Pagina IS NULL OR p_Pagina < 1 THEN SET p_Pagina = 1; END IF;
    IF p_Tamanio IS NULL OR p_Tamanio < 1 THEN SET p_Tamanio = 10; END IF;
    SET v_off = (p_Pagina - 1) * p_Tamanio;
    SELECT COUNT(*) INTO p_Total FROM VENTA v
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR v.NOMBRE LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(v.PRODUCTO, '') LIKE CONCAT('%', p_Buscar, '%'));
    SELECT v.IDVENTA, v.NOMBRE, v.PRODUCTO, t.NOMBRE AS TURNO, v.TALLA, v.PRECIO, v.MEDIO, v.FECHA
    FROM VENTA v INNER JOIN TURNO t ON t.IDTURNO = v.IDTURNO
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR v.NOMBRE LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(v.PRODUCTO, '') LIKE CONCAT('%', p_Buscar, '%'))
    ORDER BY v.FECHA DESC, v.IDVENTA DESC
    LIMIT v_off, p_Tamanio;
END$$

CREATE PROCEDURE usp_venta_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT IDVENTA, NOMBRE, PRODUCTO, IDTURNO, TALLA, OBSERVACION, PRECIO, MEDIO, FECHA
    FROM VENTA WHERE IDVENTA = p_Id;
END$$

CREATE PROCEDURE usp_venta_insertar(
    IN p_Nombre VARCHAR(200), IN p_Producto VARCHAR(60), IN p_IdTurno VARCHAR(50), IN p_Talla VARCHAR(5),
    IN p_Obs VARCHAR(500), IN p_Precio DECIMAL(10,2), IN p_Medio VARCHAR(30), IN p_Fecha CHAR(8),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    IF p_Nombre IS NULL OR TRIM(p_Nombre) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el nombre.'; LEAVE proc;
    END IF;
    IF p_IdTurno IS NULL OR NOT EXISTS (SELECT 1 FROM TURNO WHERE IDTURNO = p_IdTurno) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Selecciona un turno.'; LEAVE proc;
    END IF;
    SELECT CONCAT('VEN', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDVENTA, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM VENTA;
    INSERT INTO VENTA (IDVENTA, NOMBRE, PRODUCTO, IDTURNO, TALLA, OBSERVACION, PRECIO, MEDIO, FECHA)
    VALUES (v_id, TRIM(p_Nombre), p_Producto, p_IdTurno, p_Talla, p_Obs, IFNULL(p_Precio, 0),
            IFNULL(NULLIF(p_Medio, ''), 'Efectivo'), IFNULL(p_Fecha, DATE_FORMAT(NOW(), '%d%m%Y')));
    SET p_Resultado = 1; SET p_Mensaje = 'Venta registrada.';
END$$

CREATE PROCEDURE usp_venta_actualizar(
    IN p_Id VARCHAR(50), IN p_Nombre VARCHAR(200), IN p_Producto VARCHAR(60), IN p_IdTurno VARCHAR(50),
    IN p_Talla VARCHAR(5), IN p_Obs VARCHAR(500), IN p_Precio DECIMAL(10,2), IN p_Medio VARCHAR(30), IN p_Fecha CHAR(8),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    UPDATE VENTA
       SET NOMBRE = TRIM(p_Nombre), PRODUCTO = p_Producto, IDTURNO = p_IdTurno, TALLA = p_Talla,
           OBSERVACION = p_Obs, PRECIO = IFNULL(p_Precio, 0),
           MEDIO = IFNULL(NULLIF(p_Medio, ''), 'Efectivo'), FECHA = p_Fecha
     WHERE IDVENTA = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Venta actualizada.';
END$$

CREATE PROCEDURE usp_venta_eliminar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
BEGIN
    DELETE FROM VENTA WHERE IDVENTA = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Venta eliminada.';
END$$

CREATE PROCEDURE usp_egreso_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4),
    IN p_Pagina INT, IN p_Tamanio INT, OUT p_Total INT
)
BEGIN
    DECLARE v_off INT DEFAULT 0;
    IF p_Pagina IS NULL OR p_Pagina < 1 THEN SET p_Pagina = 1; END IF;
    IF p_Tamanio IS NULL OR p_Tamanio < 1 THEN SET p_Tamanio = 10; END IF;
    SET v_off = (p_Pagina - 1) * p_Tamanio;
    SELECT COUNT(*) INTO p_Total FROM EGRESO e
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR e.CONCEPTO LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(e.PROVEEDOR, '') LIKE CONCAT('%', p_Buscar, '%'));
    SELECT IDEGRESO, FECHA, CONCEPTO, PROVEEDOR, MONTO, MEDIO
    FROM EGRESO e
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR e.CONCEPTO LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(e.PROVEEDOR, '') LIKE CONCAT('%', p_Buscar, '%'))
    ORDER BY FECHA DESC, IDEGRESO DESC
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

CREATE PROCEDURE usp_auditoria_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4),
    IN p_Pagina INT, IN p_Tamanio INT, OUT p_Total INT
)
BEGIN
    DECLARE v_off INT DEFAULT 0;
    IF p_Pagina IS NULL OR p_Pagina < 1 THEN SET p_Pagina = 1; END IF;
    IF p_Tamanio IS NULL OR p_Tamanio < 1 THEN SET p_Tamanio = 10; END IF;
    SET v_off = (p_Pagina - 1) * p_Tamanio;
    SELECT COUNT(*) INTO p_Total FROM AUDITORIA
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR TABLA LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(IDUSUARIO, '') LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(DETALLE, '') LIKE CONCAT('%', p_Buscar, '%'));
    SELECT IDAUDITORIA, TABLA, IDREGISTRO, ACCION, IDUSUARIO, FECHA, HORA, DETALLE
    FROM AUDITORIA
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR TABLA LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(IDUSUARIO, '') LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(DETALLE, '') LIKE CONCAT('%', p_Buscar, '%'))
    ORDER BY IDAUDITORIA DESC
    LIMIT v_off, p_Tamanio;
END$$

CREATE PROCEDURE usp_auditoria_insertar(
    IN p_Tabla VARCHAR(100), IN p_IdRegistro VARCHAR(50), IN p_Accion VARCHAR(20),
    IN p_IdUsuario VARCHAR(50), IN p_Detalle VARCHAR(500),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
BEGIN
    DECLARE v_id VARCHAR(50);
    SELECT CONCAT('AUD', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDAUDITORIA, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM AUDITORIA;
    INSERT INTO AUDITORIA (IDAUDITORIA, TABLA, IDREGISTRO, ACCION, IDUSUARIO, FECHA, HORA, DETALLE)
    VALUES (v_id, p_Tabla, IFNULL(p_IdRegistro, ''), p_Accion, p_IdUsuario,
            DATE_FORMAT(NOW(), '%d%m%Y'), DATE_FORMAT(NOW(), '%H:%i:%s'), p_Detalle);
    SET p_Resultado = 1; SET p_Mensaje = 'OK';
END$$

DELIMITER ;
