USE `VoleyDB`;

DROP PROCEDURE IF EXISTS usp_membresia_recalcular;
DROP PROCEDURE IF EXISTS usp_membresia_listar;
DROP PROCEDURE IF EXISTS usp_membresia_obtener;
DROP PROCEDURE IF EXISTS usp_membresia_insertar;
DROP PROCEDURE IF EXISTS usp_membresia_actualizar;
DROP PROCEDURE IF EXISTS usp_membresia_eliminar;

DROP PROCEDURE IF EXISTS usp_mensualidad_recalcular;
DROP PROCEDURE IF EXISTS usp_mensualidad_listar;
DROP PROCEDURE IF EXISTS usp_mensualidad_obtener;
DROP PROCEDURE IF EXISTS usp_mensualidad_insertar;
DROP PROCEDURE IF EXISTS usp_mensualidad_actualizar;
DROP PROCEDURE IF EXISTS usp_mensualidad_eliminar;
DROP PROCEDURE IF EXISTS usp_pago_listar;
DROP PROCEDURE IF EXISTS usp_pago_obtener;
DROP PROCEDURE IF EXISTS usp_pago_insertar;
DROP PROCEDURE IF EXISTS usp_pago_actualizar;
DROP PROCEDURE IF EXISTS usp_pago_eliminar;

DELIMITER $$

CREATE PROCEDURE usp_mensualidad_recalcular(IN p_Id VARCHAR(50))
proc: BEGIN
    DECLARE v_pagado DECIMAL(10,2) DEFAULT 0;
    DECLARE v_monto DECIMAL(10,2) DEFAULT 0;
    DECLARE v_alu VARCHAR(50);
    IF p_Id IS NULL OR p_Id = '' THEN
        LEAVE proc;
    END IF;
    SELECT MONTO, IDALUMNA INTO v_monto, v_alu FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_Id LIMIT 1;
    IF v_alu IS NULL THEN
        LEAVE proc;
    END IF;
    SELECT IFNULL(SUM(MONTO), 0) INTO v_pagado FROM PAGO WHERE IDMENSUALIDAD = p_Id;
    UPDATE MENSUALIDAD
       SET ESTADO = IF(v_pagado >= IFNULL(v_monto, 0), 'Completada', 'Deuda')
     WHERE IDMENSUALIDAD = p_Id;
    UPDATE ALUMNA
       SET INICIOMENSUALIDAD = (
             SELECT FECHAINICIO FROM MENSUALIDAD WHERE IDALUMNA = v_alu ORDER BY FECHAFIN DESC LIMIT 1
           ),
           FINMENSUALIDAD = (
             SELECT FECHAFIN FROM MENSUALIDAD WHERE IDALUMNA = v_alu ORDER BY FECHAFIN DESC LIMIT 1
           )
     WHERE IDALUMNA = v_alu;
END$$

CREATE PROCEDURE usp_mensualidad_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4),
    IN p_Pagina INT, IN p_Tamanio INT, OUT p_Total INT
)
BEGIN
    DECLARE v_off INT DEFAULT 0;
    IF p_Pagina IS NULL OR p_Pagina < 1 THEN SET p_Pagina = 1; END IF;
    IF p_Tamanio IS NULL OR p_Tamanio < 1 THEN SET p_Tamanio = 10; END IF;
    SET v_off = (p_Pagina - 1) * p_Tamanio;
    SELECT COUNT(*) INTO p_Total
    FROM MENSUALIDAD m INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR a.NOMBRE LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR m.ESTADO = p_Estado);
    SELECT m.IDMENSUALIDAD, a.NOMBRE AS ALUMNA, m.IDALUMNA, m.FECHAINICIO, m.FECHAFIN,
           m.MONTO, m.ESTADO, m.FECHAFIN AS FECHAFIN,
           GREATEST(m.MONTO - IFNULL((SELECT SUM(p.MONTO) FROM PAGO p WHERE p.IDMENSUALIDAD = m.IDMENSUALIDAD), 0), 0) AS SALDO
    FROM MENSUALIDAD m INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR a.NOMBRE LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR m.ESTADO = p_Estado)
    ORDER BY m.FECHAFIN DESC, a.NOMBRE
    LIMIT v_off, p_Tamanio;
END$$

CREATE PROCEDURE usp_mensualidad_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT m.IDMENSUALIDAD, m.IDALUMNA, m.FECHAINICIO, m.FECHAFIN, m.MONTO, m.ESTADO, m.NOTAS,
           a.NOMBRE AS ALUMNA
    FROM MENSUALIDAD m INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
    WHERE m.IDMENSUALIDAD = p_Id;
END$$

CREATE PROCEDURE usp_mensualidad_insertar(
    IN p_IdAlumna VARCHAR(50), IN p_Inicio CHAR(8), IN p_Fin CHAR(8),
    IN p_Monto DECIMAL(10,2), IN p_Notas VARCHAR(500),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    IF p_IdAlumna IS NULL OR NOT EXISTS (SELECT 1 FROM ALUMNA WHERE IDALUMNA = p_IdAlumna) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Selecciona una alumna.'; LEAVE proc;
    END IF;
    IF p_Inicio IS NULL OR p_Fin IS NULL THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el inicio y el fin de la mensualidad.'; LEAVE proc;
    END IF;
    SELECT CONCAT('MEN', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDMENSUALIDAD, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM MENSUALIDAD;
    INSERT INTO MENSUALIDAD (IDMENSUALIDAD, IDALUMNA, FECHAINICIO, FECHAFIN, MONTO, ESTADO, NOTAS, FECHACREACION)
    VALUES (v_id, p_IdAlumna, p_Inicio, p_Fin, IFNULL(p_Monto, 0), 'Deuda', p_Notas, DATE_FORMAT(NOW(), '%d%m%Y'));
    CALL usp_mensualidad_recalcular(v_id);
    SET p_Resultado = 1; SET p_Mensaje = 'Mensualidad registrada.';
END$$

CREATE PROCEDURE usp_mensualidad_actualizar(
    IN p_Id VARCHAR(50), IN p_IdAlumna VARCHAR(50), IN p_Inicio CHAR(8), IN p_Fin CHAR(8),
    IN p_Monto DECIMAL(10,2), IN p_Notas VARCHAR(500),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    IF NOT EXISTS (SELECT 1 FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La mensualidad no existe.'; LEAVE proc;
    END IF;
    UPDATE MENSUALIDAD
       SET IDALUMNA = p_IdAlumna, FECHAINICIO = p_Inicio, FECHAFIN = p_Fin,
           MONTO = IFNULL(p_Monto, 0), NOTAS = p_Notas
     WHERE IDMENSUALIDAD = p_Id;
    CALL usp_mensualidad_recalcular(p_Id);
    SET p_Resultado = 1; SET p_Mensaje = 'Mensualidad actualizada.';
END$$

CREATE PROCEDURE usp_mensualidad_eliminar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
proc: BEGIN
    DECLARE v_alu VARCHAR(50);
    SELECT IDALUMNA INTO v_alu FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_Id;
    DELETE FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Mensualidad eliminada.';
END$$

CREATE PROCEDURE usp_pago_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4),
    IN p_Pagina INT, IN p_Tamanio INT, OUT p_Total INT
)
BEGIN
    DECLARE v_off INT DEFAULT 0;
    IF p_Pagina IS NULL OR p_Pagina < 1 THEN SET p_Pagina = 1; END IF;
    IF p_Tamanio IS NULL OR p_Tamanio < 1 THEN SET p_Tamanio = 10; END IF;
    SET v_off = (p_Pagina - 1) * p_Tamanio;
    SELECT COUNT(*) INTO p_Total
    FROM PAGO p INNER JOIN ALUMNA a ON a.IDALUMNA = p.IDALUMNA
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR a.NOMBRE LIKE CONCAT('%', p_Buscar, '%') OR p.MEDIO LIKE CONCAT('%', p_Buscar, '%'));
    SELECT p.IDPAGO, a.NOMBRE AS ALUMNA, p.IDALUMNA, p.IDMENSUALIDAD, p.FECHA, p.MONTO, p.MEDIO
    FROM PAGO p INNER JOIN ALUMNA a ON a.IDALUMNA = p.IDALUMNA
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR a.NOMBRE LIKE CONCAT('%', p_Buscar, '%') OR p.MEDIO LIKE CONCAT('%', p_Buscar, '%'))
    ORDER BY p.FECHA DESC, p.IDPAGO DESC
    LIMIT v_off, p_Tamanio;
END$$

CREATE PROCEDURE usp_pago_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT IDPAGO, IDALUMNA, IDMENSUALIDAD, FECHA, MONTO, MEDIO FROM PAGO WHERE IDPAGO = p_Id;
END$$

CREATE PROCEDURE usp_pago_insertar(
    IN p_IdAlumna VARCHAR(50), IN p_IdMensualidad VARCHAR(50), IN p_Fecha CHAR(8),
    IN p_Monto DECIMAL(10,2), IN p_Medio VARCHAR(30),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    DECLARE v_alu VARCHAR(50);
    SET v_alu = p_IdAlumna;
    IF p_IdMensualidad IS NOT NULL AND p_IdMensualidad <> '' THEN
        SELECT IDALUMNA INTO v_alu FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_IdMensualidad;
    END IF;
    IF v_alu IS NULL OR NOT EXISTS (SELECT 1 FROM ALUMNA WHERE IDALUMNA = v_alu) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Selecciona una alumna.'; LEAVE proc;
    END IF;
    IF p_Monto IS NULL OR p_Monto <= 0 THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa un monto mayor a cero.'; LEAVE proc;
    END IF;
    SELECT CONCAT('PAG', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDPAGO, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM PAGO;
    INSERT INTO PAGO (IDPAGO, IDMENSUALIDAD, IDALUMNA, FECHA, MONTO, MEDIO, FECHACREACION)
    VALUES (v_id, NULLIF(p_IdMensualidad, ''), v_alu, IFNULL(p_Fecha, DATE_FORMAT(NOW(), '%d%m%Y')),
            p_Monto, IFNULL(NULLIF(p_Medio, ''), 'Efectivo'), DATE_FORMAT(NOW(), '%d%m%Y'));
    IF p_IdMensualidad IS NOT NULL AND p_IdMensualidad <> '' THEN
        CALL usp_mensualidad_recalcular(p_IdMensualidad);
    END IF;
    SET p_Resultado = 1; SET p_Mensaje = 'Pago registrado.';
END$$

CREATE PROCEDURE usp_pago_actualizar(
    IN p_Id VARCHAR(50), IN p_IdAlumna VARCHAR(50), IN p_IdMensualidad VARCHAR(50), IN p_Fecha CHAR(8),
    IN p_Monto DECIMAL(10,2), IN p_Medio VARCHAR(30),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_men_ant VARCHAR(50);
    SELECT IDMENSUALIDAD INTO v_men_ant FROM PAGO WHERE IDPAGO = p_Id;
    UPDATE PAGO
       SET IDALUMNA = p_IdAlumna, IDMENSUALIDAD = NULLIF(p_IdMensualidad, ''),
           FECHA = p_Fecha, MONTO = p_Monto, MEDIO = IFNULL(NULLIF(p_Medio, ''), 'Efectivo')
     WHERE IDPAGO = p_Id;
    IF v_men_ant IS NOT NULL THEN CALL usp_mensualidad_recalcular(v_men_ant); END IF;
    IF p_IdMensualidad IS NOT NULL AND p_IdMensualidad <> '' THEN CALL usp_mensualidad_recalcular(p_IdMensualidad); END IF;
    SET p_Resultado = 1; SET p_Mensaje = 'Pago actualizado.';
END$$

CREATE PROCEDURE usp_pago_eliminar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
proc: BEGIN
    DECLARE v_men VARCHAR(50);
    SELECT IDMENSUALIDAD INTO v_men FROM PAGO WHERE IDPAGO = p_Id;
    DELETE FROM PAGO WHERE IDPAGO = p_Id;
    IF v_men IS NOT NULL THEN CALL usp_mensualidad_recalcular(v_men); END IF;
    SET p_Resultado = 1; SET p_Mensaje = 'Pago eliminado.';
END$$

DELIMITER ;
