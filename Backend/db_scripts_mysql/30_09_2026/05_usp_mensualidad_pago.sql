USE `VoleyDB`;

DROP PROCEDURE IF EXISTS usp_membresia_recalcular;
DROP PROCEDURE IF EXISTS usp_membresia_listar;
DROP PROCEDURE IF EXISTS usp_membresia_obtener;
DROP PROCEDURE IF EXISTS usp_membresia_insertar;
DROP PROCEDURE IF EXISTS usp_membresia_actualizar;
DROP PROCEDURE IF EXISTS usp_membresia_eliminar;

DROP PROCEDURE IF EXISTS usp_alumna_periodo_actual;
DROP PROCEDURE IF EXISTS usp_mensualidad_recalcular;
DROP PROCEDURE IF EXISTS usp_mensualidad_listar;
DROP PROCEDURE IF EXISTS usp_mensualidad_obtener;
DROP PROCEDURE IF EXISTS usp_mensualidad_validar;
DROP PROCEDURE IF EXISTS usp_mensualidad_insertar;
DROP PROCEDURE IF EXISTS usp_mensualidad_actualizar;
DROP PROCEDURE IF EXISTS usp_mensualidad_eliminar;
DROP PROCEDURE IF EXISTS usp_mensualidad_renovar;
DROP PROCEDURE IF EXISTS usp_pago_listar;
DROP PROCEDURE IF EXISTS usp_pago_obtener;
DROP PROCEDURE IF EXISTS usp_pago_validar;
DROP PROCEDURE IF EXISTS usp_pago_insertar;
DROP PROCEDURE IF EXISTS usp_pago_actualizar;
DROP PROCEDURE IF EXISTS usp_pago_eliminar;
DROP PROCEDURE IF EXISTS usp_mensualidad_por_alumna;

DELIMITER $$

-- Periodos que se pueden pagar de una alumna (select de mensualidad en Pagos).
CREATE PROCEDURE usp_mensualidad_por_alumna(IN p_IdAlumna VARCHAR(50))
BEGIN
    SELECT m.IDMENSUALIDAD, m.IDALUMNA, m.FECHAINICIO, m.FECHAFIN, m.ESTADO, m.MONTO,
           GREATEST(m.MONTO - IFNULL(pg.PAGADO, 0), 0) AS SALDO
    FROM MENSUALIDAD m
    LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
           ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
    WHERE m.IDALUMNA = p_IdAlumna
      AND m.ESTADO <> 'Inactivo'
    ORDER BY STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') DESC;
END$$

-- El periodo vigente de la alumna es el último que no está marcado como inactivo.
CREATE PROCEDURE usp_alumna_periodo_actual(IN p_IdAlumna VARCHAR(50))
BEGIN
    UPDATE ALUMNA
       SET INICIOMENSUALIDAD = (
             SELECT FECHAINICIO FROM MENSUALIDAD WHERE IDALUMNA = p_IdAlumna
             ORDER BY ESTADO = 'Inactivo', STR_TO_DATE(FECHAFIN, '%d%m%Y') DESC LIMIT 1
           ),
           FINMENSUALIDAD = (
             SELECT FECHAFIN FROM MENSUALIDAD WHERE IDALUMNA = p_IdAlumna
             ORDER BY ESTADO = 'Inactivo', STR_TO_DATE(FECHAFIN, '%d%m%Y') DESC LIMIT 1
           )
     WHERE IDALUMNA = p_IdAlumna;
END$$

CREATE PROCEDURE usp_mensualidad_recalcular(IN p_Id VARCHAR(50))
proc: BEGIN
    DECLARE v_pagado DECIMAL(10,2) DEFAULT 0;
    DECLARE v_monto DECIMAL(10,2) DEFAULT 0;
    DECLARE v_alu VARCHAR(50);
    DECLARE v_estado VARCHAR(20);
    IF p_Id IS NULL OR p_Id = '' THEN
        LEAVE proc;
    END IF;
    SELECT MONTO, IDALUMNA, ESTADO INTO v_monto, v_alu, v_estado FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_Id LIMIT 1;
    IF v_alu IS NULL THEN
        LEAVE proc;
    END IF;
    SELECT IFNULL(SUM(MONTO), 0) INTO v_pagado FROM PAGO WHERE IDMENSUALIDAD = p_Id;
    IF v_estado <> 'Inactivo' THEN
        UPDATE MENSUALIDAD
           SET ESTADO = CASE
                 WHEN v_pagado >= IFNULL(v_monto, 0) THEN 'Completada'
                 WHEN v_pagado > 0 THEN 'Parcial'
                 ELSE 'Deuda'
               END
         WHERE IDMENSUALIDAD = p_Id;
    END IF;
    CALL usp_alumna_periodo_actual(v_alu);
END$$

-- TIPO: Matrícula si es el primer periodo de la alumna; Mensualidad en los siguientes.
-- SITUACION: Pagada, Pendiente (aún en plazo), Vencida (terminó con saldo) o Inactivo.
-- VIGENCIA: Vigente, Finalizada o Por iniciar según la fecha de hoy.
-- El rango de fechas toma los periodos que se cruzan con él.
CREATE PROCEDURE usp_mensualidad_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_Desde CHAR(8), IN p_Hasta CHAR(8), IN p_IdCiclo VARCHAR(50),
    IN p_Situacion VARCHAR(20), IN p_Tipo VARCHAR(20),
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

    DROP TEMPORARY TABLE IF EXISTS tmp_men_lista;
    CREATE TEMPORARY TABLE tmp_men_lista AS
    SELECT x.* FROM (
        SELECT m.IDMENSUALIDAD, a.NOMBRE AS ALUMNA, m.IDALUMNA, c.NOMBRE AS CICLO, m.FECHAINICIO, m.FECHAFIN,
               m.MONTO, m.MONTOREGULAR, m.ESTADO, m.IDPROMOCION, pr.NOMBRE AS PROMOCION,
               GREATEST(IFNULL(m.MONTOREGULAR, m.MONTO) - m.MONTO, 0) AS DESCUENTO,
               IFNULL(pg.PAGADO, 0) AS PAGADO,
               IF(m.ESTADO = 'Inactivo', 0, GREATEST(m.MONTO - IFNULL(pg.PAGADO, 0), 0)) AS SALDO,
               IF(EXISTS (SELECT 1 FROM MENSUALIDAD p
                           WHERE p.IDALUMNA = m.IDALUMNA
                             AND (STR_TO_DATE(p.FECHAINICIO, '%d%m%Y') < STR_TO_DATE(m.FECHAINICIO, '%d%m%Y')
                                  OR (p.FECHAINICIO = m.FECHAINICIO AND p.IDMENSUALIDAD < m.IDMENSUALIDAD))),
                  'Mensualidad', 'Matrícula') AS TIPO,
               CASE
                 WHEN m.ESTADO = 'Inactivo' THEN 'Inactivo'
                 WHEN m.ESTADO = 'Completada' THEN 'Pagada'
                 WHEN STR_TO_DATE(m.FECHAFIN, '%d%m%Y') < CURDATE() THEN 'Vencida'
                 ELSE 'Pendiente'
               END AS SITUACION,
               CASE
                 WHEN STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') > CURDATE() THEN 'Por iniciar'
                 WHEN STR_TO_DATE(m.FECHAFIN, '%d%m%Y') < CURDATE() THEN 'Finalizada'
                 ELSE 'Vigente'
               END AS VIGENCIA,
               fn_traza('MENSUALIDAD', m.IDMENSUALIDAD, 'R') AS REGISTRADOPOR,
               fn_traza('MENSUALIDAD', m.IDMENSUALIDAD, 'M') AS MODIFICADOPOR
        FROM MENSUALIDAD m
        INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN PROMOCION pr ON pr.IDPROMOCION = m.IDPROMOCION
        LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
               ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
        WHERE (p_Buscar IS NULL OR p_Buscar = '' OR a.NOMBRE LIKE CONCAT('%', p_Buscar, '%')
               OR IFNULL(a.DNI, '') LIKE CONCAT(p_Buscar, '%') OR m.IDMENSUALIDAD LIKE CONCAT('%', p_Buscar, '%'))
          AND (p_Estado IS NULL OR p_Estado = '' OR m.ESTADO = p_Estado)
          AND (p_IdCiclo IS NULL OR p_IdCiclo = '' OR a.IDCICLO = p_IdCiclo)
          AND (v_hasta IS NULL OR STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') <= v_hasta)
          AND (v_desde IS NULL OR STR_TO_DATE(m.FECHAFIN, '%d%m%Y') >= v_desde)
    ) x
    WHERE (p_Situacion IS NULL OR p_Situacion = '' OR x.SITUACION = p_Situacion OR x.VIGENCIA = p_Situacion)
      AND (p_Tipo IS NULL OR p_Tipo = '' OR x.TIPO = p_Tipo);

    SELECT COUNT(*) INTO p_Total FROM tmp_men_lista;
    SELECT * FROM tmp_men_lista
    ORDER BY STR_TO_DATE(FECHAFIN, '%d%m%Y') DESC, ALUMNA
    LIMIT v_off, p_Tamanio;
    DROP TEMPORARY TABLE IF EXISTS tmp_men_lista;
END$$

CREATE PROCEDURE usp_mensualidad_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT m.IDMENSUALIDAD, m.IDALUMNA, m.FECHAINICIO, m.FECHAFIN, m.MONTO, m.MONTOREGULAR, m.ESTADO, m.NOTAS,
           m.IDPROMOCION, m.IDRENOVADA, a.NOMBRE AS ALUMNA,
           IF(m.ESTADO = 'Inactivo', 'Inactivo', 'Activo') AS PERIODO,
           IFNULL((SELECT SUM(p.MONTO) FROM PAGO p WHERE p.IDMENSUALIDAD = m.IDMENSUALIDAD), 0) AS PAGADO
    FROM MENSUALIDAD m INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
    WHERE m.IDMENSUALIDAD = p_Id;
END$$

-- Valida un periodo y calcula el monto. p_Id es NULL al registrar.
CREATE PROCEDURE usp_mensualidad_validar(
    IN p_Id VARCHAR(50), IN p_IdAlumna VARCHAR(50), IN p_Inicio CHAR(8), IN p_Fin CHAR(8),
    IN p_Monto DECIMAL(10,2), IN p_MontoRegular DECIMAL(10,2), IN p_IdPromocion VARCHAR(50), IN p_Periodo VARCHAR(20),
    OUT p_MontoFinal DECIMAL(10,2), OUT p_RegularFinal DECIMAL(10,2), OUT p_Error VARCHAR(200)
)
proc: BEGIN
    DECLARE v_cruce VARCHAR(60);
    DECLARE v_tipo VARCHAR(30);
    DECLARE v_activo TINYINT;
    DECLARE v_pini CHAR(8);
    DECLARE v_pfin CHAR(8);
    DECLARE v_previas INT DEFAULT 0;
    DECLARE v_usadas INT DEFAULT 0;
    DECLARE v_preg DECIMAL(10,2);
    SET p_Error = NULL;
    IF p_IdAlumna IS NULL OR NOT EXISTS (SELECT 1 FROM ALUMNA WHERE IDALUMNA = p_IdAlumna) THEN
        SET p_Error = 'Selecciona una alumna.'; LEAVE proc;
    END IF;
    IF p_Inicio IS NULL OR p_Fin IS NULL THEN
        SET p_Error = 'Ingresa el inicio y el fin del periodo.'; LEAVE proc;
    END IF;
    IF STR_TO_DATE(p_Fin, '%d%m%Y') < STR_TO_DATE(p_Inicio, '%d%m%Y') THEN
        SET p_Error = 'El fin del periodo no puede ser anterior al inicio.'; LEAVE proc;
    END IF;
    IF p_Id IS NULL THEN
        SELECT CONCAT(fn_fecha_vista(FECHAINICIO), ' al ', fn_fecha_vista(FECHAFIN)) INTO v_cruce
          FROM MENSUALIDAD
         WHERE IDALUMNA = p_IdAlumna AND ESTADO <> 'Inactivo'
           AND STR_TO_DATE(FECHAINICIO, '%d%m%Y') <= STR_TO_DATE(p_Fin, '%d%m%Y')
           AND STR_TO_DATE(p_Inicio, '%d%m%Y') <= STR_TO_DATE(FECHAFIN, '%d%m%Y')
         LIMIT 1;
        IF v_cruce IS NOT NULL AND IFNULL(p_Periodo, 'Activo') <> 'Inactivo' THEN
            SET p_Error = CONCAT('La alumna ya tiene un periodo que se cruza con esas fechas (', v_cruce, ').'); LEAVE proc;
        END IF;
    END IF;

    IF IFNULL(p_Periodo, 'Activo') = 'Inactivo' THEN
        SET p_MontoFinal = 0;
        SET p_RegularFinal = NULL;
        LEAVE proc;
    END IF;

    IF p_IdPromocion IS NOT NULL AND p_IdPromocion <> '' THEN
        SELECT TIPO, ACTIVO, FECHAINICIO, FECHAFIN, MONTOREGULAR INTO v_tipo, v_activo, v_pini, v_pfin, v_preg
          FROM PROMOCION WHERE IDPROMOCION = p_IdPromocion;
        IF v_tipo IS NULL THEN
            SET p_Error = 'La promoción elegida no existe.'; LEAVE proc;
        END IF;
        SELECT COUNT(*) INTO v_usadas FROM MENSUALIDAD
         WHERE IDALUMNA = p_IdAlumna AND IDPROMOCION = p_IdPromocion AND ESTADO <> 'Inactivo'
           AND (p_Id IS NULL OR IDMENSUALIDAD <> p_Id);
        IF v_usadas = 0 THEN
            IF v_activo = 0 THEN
                SET p_Error = 'La promoción está desactivada.'; LEAVE proc;
            END IF;
            IF v_pini IS NOT NULL AND v_pini <> '' AND STR_TO_DATE(p_Inicio, '%d%m%Y') < STR_TO_DATE(v_pini, '%d%m%Y') THEN
                SET p_Error = CONCAT('La promoción empieza el ', fn_fecha_vista(v_pini), '.'); LEAVE proc;
            END IF;
            IF v_pfin IS NOT NULL AND v_pfin <> '' AND STR_TO_DATE(p_Inicio, '%d%m%Y') > STR_TO_DATE(v_pfin, '%d%m%Y') THEN
                SET p_Error = CONCAT('La promoción terminó el ', fn_fecha_vista(v_pfin), '.'); LEAVE proc;
            END IF;
            SELECT COUNT(*) INTO v_previas FROM MENSUALIDAD
             WHERE IDALUMNA = p_IdAlumna AND ESTADO <> 'Inactivo'
               AND (p_Id IS NULL OR IDMENSUALIDAD <> p_Id)
               AND STR_TO_DATE(FECHAINICIO, '%d%m%Y') < STR_TO_DATE(p_Inicio, '%d%m%Y');
            IF v_tipo = 'Nueva matrícula' AND v_previas > 0 THEN
                SET p_Error = 'Esta promoción es solo para alumnas nuevas y la alumna ya tiene periodos anteriores.'; LEAVE proc;
            END IF;
            IF v_tipo = 'Retorno' AND v_previas = 0 THEN
                SET p_Error = 'Esta promoción es para alumnas que retornan y la alumna no tiene periodos anteriores.'; LEAVE proc;
            END IF;
        END IF;
        SET p_MontoFinal = IF(p_Monto IS NULL OR p_Monto <= 0, fn_monto_promocion(p_IdAlumna, p_IdPromocion, p_Id), p_Monto);
        SET p_RegularFinal = IFNULL(NULLIF(p_MontoRegular, 0), v_preg);
    ELSE
        SET p_MontoFinal = IFNULL(p_Monto, (SELECT MENSUALIDAD FROM ALUMNA WHERE IDALUMNA = p_IdAlumna));
        IF p_MontoFinal IS NULL THEN
            SET p_Error = 'Ingresa el monto a cobrar.'; LEAVE proc;
        END IF;
        SET p_RegularFinal = NULLIF(p_MontoRegular, 0);
    END IF;
    IF p_RegularFinal IS NOT NULL AND p_RegularFinal < p_MontoFinal THEN
        SET p_Error = 'La tarifa regular no puede ser menor que el monto a cobrar.'; LEAVE proc;
    END IF;
END$$

CREATE PROCEDURE usp_mensualidad_insertar(
    IN p_IdAlumna VARCHAR(50), IN p_Inicio CHAR(8), IN p_Fin CHAR(8),
    IN p_Monto DECIMAL(10,2), IN p_MontoRegular DECIMAL(10,2), IN p_IdPromocion VARCHAR(50),
    IN p_Periodo VARCHAR(20), IN p_Notas VARCHAR(500),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    DECLARE v_monto DECIMAL(10,2);
    DECLARE v_regular DECIMAL(10,2);
    DECLARE v_error VARCHAR(200);
    DECLARE v_inactivo TINYINT DEFAULT 0;
    SET v_inactivo = IF(IFNULL(p_Periodo, 'Activo') = 'Inactivo', 1, 0);
    CALL usp_mensualidad_validar(NULL, p_IdAlumna, p_Inicio, p_Fin, p_Monto, p_MontoRegular, p_IdPromocion, p_Periodo,
                                 v_monto, v_regular, v_error);
    IF v_error IS NOT NULL THEN
        SET p_Resultado = 0; SET p_Mensaje = v_error; LEAVE proc;
    END IF;
    SELECT CONCAT('MEN', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDMENSUALIDAD, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM MENSUALIDAD;
    INSERT INTO MENSUALIDAD (IDMENSUALIDAD, IDALUMNA, FECHAINICIO, FECHAFIN, MONTO, MONTOREGULAR, ESTADO,
                             IDPROMOCION, NOTAS, FECHACREACION)
    VALUES (v_id, p_IdAlumna, p_Inicio, p_Fin, v_monto, v_regular, IF(v_inactivo = 1, 'Inactivo', 'Deuda'),
            IF(v_inactivo = 1, NULL, NULLIF(p_IdPromocion, '')), p_Notas, DATE_FORMAT(NOW(), '%d%m%Y'));
    CALL usp_mensualidad_recalcular(v_id);
    SET p_Resultado = 1;
    IF v_inactivo = 1 THEN
        SET p_Mensaje = 'Periodo inactivo registrado. No genera deuda.';
    ELSEIF v_regular IS NOT NULL AND v_regular > v_monto THEN
        SET p_Mensaje = CONCAT('Mensualidad registrada por S/ ', FORMAT(v_monto, 2), '. Los S/ ', FORMAT(v_regular - v_monto, 2),
                               ' de diferencia quedan como descuento, no como deuda.');
    ELSE
        SET p_Mensaje = CONCAT('Mensualidad registrada por S/ ', FORMAT(v_monto, 2), '.');
    END IF;
END$$

CREATE PROCEDURE usp_mensualidad_actualizar(
    IN p_Id VARCHAR(50), IN p_IdAlumna VARCHAR(50), IN p_Inicio CHAR(8), IN p_Fin CHAR(8),
    IN p_Monto DECIMAL(10,2), IN p_MontoRegular DECIMAL(10,2), IN p_IdPromocion VARCHAR(50),
    IN p_Periodo VARCHAR(20), IN p_Notas VARCHAR(500),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_monto DECIMAL(10,2);
    DECLARE v_regular DECIMAL(10,2);
    DECLARE v_error VARCHAR(200);
    DECLARE v_inactivo TINYINT DEFAULT 0;
    DECLARE v_pagado DECIMAL(10,2) DEFAULT 0;
    DECLARE v_alu_ant VARCHAR(50);
    IF NOT EXISTS (SELECT 1 FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La mensualidad no existe.'; LEAVE proc;
    END IF;
    SET v_inactivo = IF(IFNULL(p_Periodo, 'Activo') = 'Inactivo', 1, 0);
    SELECT IFNULL(SUM(MONTO), 0) INTO v_pagado FROM PAGO WHERE IDMENSUALIDAD = p_Id;
    SELECT IDALUMNA INTO v_alu_ant FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_Id;
    IF v_inactivo = 1 AND v_pagado > 0 THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Este periodo tiene pagos; no se puede marcar como inactivo.'; LEAVE proc;
    END IF;
    IF v_pagado > 0 AND v_alu_ant <> p_IdAlumna THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Este periodo tiene pagos; no se puede pasar a otra alumna.'; LEAVE proc;
    END IF;
    CALL usp_mensualidad_validar(p_Id, p_IdAlumna, p_Inicio, p_Fin, p_Monto, p_MontoRegular, p_IdPromocion, p_Periodo,
                                 v_monto, v_regular, v_error);
    IF v_error IS NOT NULL THEN
        SET p_Resultado = 0; SET p_Mensaje = v_error; LEAVE proc;
    END IF;
    UPDATE MENSUALIDAD
       SET IDALUMNA = p_IdAlumna, FECHAINICIO = p_Inicio, FECHAFIN = p_Fin,
           MONTO = v_monto, MONTOREGULAR = v_regular,
           IDPROMOCION = IF(v_inactivo = 1, NULL, NULLIF(p_IdPromocion, '')),
           ESTADO = IF(v_inactivo = 1, 'Inactivo', IF(ESTADO = 'Inactivo', 'Deuda', ESTADO)),
           NOTAS = p_Notas
     WHERE IDMENSUALIDAD = p_Id;
    CALL usp_mensualidad_recalcular(p_Id);
    IF v_alu_ant <> p_IdAlumna THEN
        CALL usp_alumna_periodo_actual(v_alu_ant);
    END IF;
    SET p_Resultado = 1;
    SET p_Mensaje = IF(v_inactivo = 1, 'Periodo marcado como inactivo. No genera deuda.', 'Mensualidad actualizada.');
END$$

CREATE PROCEDURE usp_mensualidad_eliminar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
proc: BEGIN
    DECLARE v_alu VARCHAR(50);
    SELECT IDALUMNA INTO v_alu FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_Id;
    IF v_alu IS NULL THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La mensualidad no existe.'; LEAVE proc;
    END IF;
    IF EXISTS (SELECT 1 FROM PAGO WHERE IDMENSUALIDAD = p_Id) THEN
        SET p_Resultado = 0;
        SET p_Mensaje = 'Este periodo tiene pagos. Elimina o corrige primero esos pagos para no dejarlos sin periodo.';
        LEAVE proc;
    END IF;
    DELETE FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_Id;
    CALL usp_alumna_periodo_actual(v_alu);
    SET p_Resultado = 1; SET p_Mensaje = 'Mensualidad eliminada.';
END$$

-- Genera el periodo siguiente. Si la mensualidad tiene promoción, el monto sale de la promoción.
CREATE PROCEDURE usp_mensualidad_renovar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
proc: BEGIN
    DECLARE v_alu VARCHAR(50);
    DECLARE v_fin CHAR(8);
    DECLARE v_monto_ant DECIMAL(10,2);
    DECLARE v_regular_ant DECIMAL(10,2);
    DECLARE v_promo VARCHAR(50);
    DECLARE v_ini_d DATE;
    DECLARE v_fin_d DATE;
    DECLARE v_monto DECIMAL(10,2);
    DECLARE v_regular DECIMAL(10,2);
    DECLARE v_id VARCHAR(50);
    SELECT IDALUMNA, FECHAFIN, MONTO, MONTOREGULAR, IDPROMOCION
      INTO v_alu, v_fin, v_monto_ant, v_regular_ant, v_promo
      FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_Id;
    IF v_alu IS NULL THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La mensualidad no existe.'; LEAVE proc;
    END IF;
    SET v_ini_d = DATE_ADD(STR_TO_DATE(v_fin, '%d%m%Y'), INTERVAL 1 DAY);
    SET v_fin_d = DATE_SUB(DATE_ADD(v_ini_d, INTERVAL 1 MONTH), INTERVAL 1 DAY);
    IF EXISTS (
        SELECT 1 FROM MENSUALIDAD
        WHERE IDALUMNA = v_alu AND ESTADO <> 'Inactivo'
          AND STR_TO_DATE(FECHAINICIO, '%d%m%Y') <= v_fin_d
          AND v_ini_d <= STR_TO_DATE(FECHAFIN, '%d%m%Y')
    ) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'El periodo siguiente ya está registrado.'; LEAVE proc;
    END IF;
    IF v_promo IS NOT NULL THEN
        SET v_monto = fn_monto_promocion(v_alu, v_promo, NULL);
        SET v_regular = IFNULL(v_regular_ant, (SELECT MONTOREGULAR FROM PROMOCION WHERE IDPROMOCION = v_promo));
    ELSE
        SET v_monto = v_monto_ant;
        SET v_regular = v_regular_ant;
    END IF;
    IF v_regular IS NOT NULL AND v_regular < v_monto THEN
        SET v_regular = v_monto;
    END IF;
    SELECT CONCAT('MEN', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDMENSUALIDAD, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM MENSUALIDAD;
    INSERT INTO MENSUALIDAD (IDMENSUALIDAD, IDALUMNA, FECHAINICIO, FECHAFIN, MONTO, MONTOREGULAR, ESTADO,
                             IDRENOVADA, IDPROMOCION, FECHACREACION)
    VALUES (v_id, v_alu, DATE_FORMAT(v_ini_d, '%d%m%Y'), DATE_FORMAT(v_fin_d, '%d%m%Y'), v_monto, v_regular, 'Deuda',
            p_Id, v_promo, DATE_FORMAT(NOW(), '%d%m%Y'));
    CALL usp_mensualidad_recalcular(v_id);
    SET p_Resultado = 1;
    SET p_Mensaje = CONCAT('Periodo del ', DATE_FORMAT(v_ini_d, '%d/%m/%Y'), ' al ', DATE_FORMAT(v_fin_d, '%d/%m/%Y'),
                           ' generado por S/ ', FORMAT(v_monto, 2), '.');
END$$

-- p_Estado filtra por medio de pago.
CREATE PROCEDURE usp_pago_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_Desde CHAR(8), IN p_Hasta CHAR(8), IN p_IdCiclo VARCHAR(50),
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
    SELECT COUNT(*) INTO p_Total
    FROM PAGO p INNER JOIN ALUMNA a ON a.IDALUMNA = p.IDALUMNA
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR a.NOMBRE LIKE CONCAT('%', p_Buscar, '%')
           OR p.IDPAGO LIKE CONCAT('%', p_Buscar, '%') OR IFNULL(a.DNI, '') LIKE CONCAT(p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR p.MEDIO = p_Estado)
      AND (p_IdCiclo IS NULL OR p_IdCiclo = '' OR a.IDCICLO = p_IdCiclo)
      AND (v_desde IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') >= v_desde)
      AND (v_hasta IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') <= v_hasta);
    SELECT p.IDPAGO, a.NOMBRE AS ALUMNA, p.IDALUMNA, c.NOMBRE AS CICLO, p.IDMENSUALIDAD, p.FECHA, p.MONTO, p.MEDIO,
           CONCAT(fn_fecha_vista(m.FECHAINICIO), ' - ', fn_fecha_vista(m.FECHAFIN)) AS PERIODO,
           m.ESTADO AS ESTADOPERIODO,
           fn_traza('PAGO', p.IDPAGO, 'R') AS REGISTRADOPOR,
           fn_traza('PAGO', p.IDPAGO, 'M') AS MODIFICADOPOR
    FROM PAGO p
    INNER JOIN ALUMNA a ON a.IDALUMNA = p.IDALUMNA
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN MENSUALIDAD m ON m.IDMENSUALIDAD = p.IDMENSUALIDAD
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR a.NOMBRE LIKE CONCAT('%', p_Buscar, '%')
           OR p.IDPAGO LIKE CONCAT('%', p_Buscar, '%') OR IFNULL(a.DNI, '') LIKE CONCAT(p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR p.MEDIO = p_Estado)
      AND (p_IdCiclo IS NULL OR p_IdCiclo = '' OR a.IDCICLO = p_IdCiclo)
      AND (v_desde IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') >= v_desde)
      AND (v_hasta IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') <= v_hasta)
    ORDER BY STR_TO_DATE(p.FECHA, '%d%m%Y') DESC, p.IDPAGO DESC
    LIMIT v_off, p_Tamanio;
END$$

CREATE PROCEDURE usp_pago_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT p.IDPAGO, p.IDALUMNA, p.IDMENSUALIDAD, p.FECHA, p.MONTO, p.MEDIO, a.NOMBRE AS ALUMNA
    FROM PAGO p INNER JOIN ALUMNA a ON a.IDALUMNA = p.IDALUMNA
    WHERE p.IDPAGO = p_Id;
END$$

-- El pago siempre va a un periodo elegido explícitamente y no puede superar su saldo,
-- así nunca se traslada solo a otro periodo.
CREATE PROCEDURE usp_pago_validar(
    IN p_IdPago VARCHAR(50), IN p_IdAlumna VARCHAR(50), IN p_IdMensualidad VARCHAR(50), IN p_Monto DECIMAL(10,2),
    OUT p_Alumna VARCHAR(50), OUT p_Saldo DECIMAL(10,2), OUT p_Error VARCHAR(200)
)
proc: BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_monto DECIMAL(10,2);
    DECLARE v_pagado DECIMAL(10,2) DEFAULT 0;
    DECLARE v_men_ant VARCHAR(50);
    DECLARE v_monto_ant DECIMAL(10,2) DEFAULT 0;
    SET p_Error = NULL;
    IF p_IdMensualidad IS NULL OR p_IdMensualidad = '' THEN
        SET p_Error = 'Selecciona el periodo (mensualidad) al que corresponde el pago.'; LEAVE proc;
    END IF;
    SELECT IDALUMNA, ESTADO, MONTO INTO p_Alumna, v_estado, v_monto FROM MENSUALIDAD WHERE IDMENSUALIDAD = p_IdMensualidad;
    IF p_Alumna IS NULL THEN
        SET p_Error = 'El periodo elegido no existe.'; LEAVE proc;
    END IF;
    IF p_IdAlumna IS NOT NULL AND p_IdAlumna <> '' AND p_IdAlumna <> p_Alumna THEN
        SET p_Error = 'El periodo elegido no pertenece a esa alumna.'; LEAVE proc;
    END IF;
    IF v_estado = 'Inactivo' THEN
        SET p_Error = 'Ese periodo está marcado como inactivo (la alumna no asistió). Elige el periodo que corresponde al pago.'; LEAVE proc;
    END IF;
    IF p_Monto IS NULL OR p_Monto <= 0 THEN
        SET p_Error = 'Ingresa un monto mayor a cero.'; LEAVE proc;
    END IF;
    IF p_IdPago IS NOT NULL THEN
        SELECT IDMENSUALIDAD, MONTO INTO v_men_ant, v_monto_ant FROM PAGO WHERE IDPAGO = p_IdPago;
    END IF;
    SELECT IFNULL(SUM(MONTO), 0) INTO v_pagado FROM PAGO
     WHERE IDMENSUALIDAD = p_IdMensualidad AND (p_IdPago IS NULL OR IDPAGO <> p_IdPago);
    SET p_Saldo = GREATEST(v_monto - v_pagado, 0);
    IF p_IdPago IS NOT NULL AND v_men_ant = p_IdMensualidad AND p_Monto <= v_monto_ant THEN
        LEAVE proc;
    END IF;
    IF p_Saldo <= 0 THEN
        SET p_Error = 'Ese periodo ya está pagado. Elige el periodo al que corresponde el pago o registra uno nuevo.'; LEAVE proc;
    END IF;
    IF p_Monto > p_Saldo THEN
        SET p_Error = CONCAT('El pago supera el saldo del periodo (S/ ', FORMAT(p_Saldo, 2),
                             '). Registra la diferencia en el periodo que corresponde.');
        LEAVE proc;
    END IF;
END$$

CREATE PROCEDURE usp_pago_insertar(
    IN p_IdAlumna VARCHAR(50), IN p_IdMensualidad VARCHAR(50), IN p_Fecha CHAR(8),
    IN p_Monto DECIMAL(10,2), IN p_Medio VARCHAR(30),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    DECLARE v_alu VARCHAR(50);
    DECLARE v_saldo DECIMAL(10,2);
    DECLARE v_error VARCHAR(200);
    CALL usp_pago_validar(NULL, p_IdAlumna, p_IdMensualidad, p_Monto, v_alu, v_saldo, v_error);
    IF v_error IS NOT NULL THEN
        SET p_Resultado = 0; SET p_Mensaje = v_error; LEAVE proc;
    END IF;
    SELECT CONCAT('PAG', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDPAGO, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM PAGO;
    INSERT INTO PAGO (IDPAGO, IDMENSUALIDAD, IDALUMNA, FECHA, MONTO, MEDIO, FECHACREACION)
    VALUES (v_id, p_IdMensualidad, v_alu, IFNULL(p_Fecha, DATE_FORMAT(NOW(), '%d%m%Y')),
            p_Monto, IFNULL(NULLIF(p_Medio, ''), 'Efectivo'), DATE_FORMAT(NOW(), '%d%m%Y'));
    CALL usp_mensualidad_recalcular(p_IdMensualidad);
    SET p_Resultado = 1;
    IF v_saldo - p_Monto > 0 THEN
        SET p_Mensaje = CONCAT('Pago parcial registrado. Saldo pendiente del periodo: S/ ', FORMAT(v_saldo - p_Monto, 2), '.');
    ELSE
        SET p_Mensaje = 'Pago registrado. El periodo quedó pagado.';
    END IF;
END$$

CREATE PROCEDURE usp_pago_actualizar(
    IN p_Id VARCHAR(50), IN p_IdAlumna VARCHAR(50), IN p_IdMensualidad VARCHAR(50), IN p_Fecha CHAR(8),
    IN p_Monto DECIMAL(10,2), IN p_Medio VARCHAR(30),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_men_ant VARCHAR(50);
    DECLARE v_alu VARCHAR(50);
    DECLARE v_saldo DECIMAL(10,2);
    DECLARE v_error VARCHAR(200);
    IF NOT EXISTS (SELECT 1 FROM PAGO WHERE IDPAGO = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'El pago no existe.'; LEAVE proc;
    END IF;
    SELECT IDMENSUALIDAD INTO v_men_ant FROM PAGO WHERE IDPAGO = p_Id;
    CALL usp_pago_validar(p_Id, p_IdAlumna, p_IdMensualidad, p_Monto, v_alu, v_saldo, v_error);
    IF v_error IS NOT NULL THEN
        SET p_Resultado = 0; SET p_Mensaje = v_error; LEAVE proc;
    END IF;
    UPDATE PAGO
       SET IDALUMNA = v_alu, IDMENSUALIDAD = p_IdMensualidad,
           FECHA = p_Fecha, MONTO = p_Monto, MEDIO = IFNULL(NULLIF(p_Medio, ''), 'Efectivo')
     WHERE IDPAGO = p_Id;
    IF v_men_ant IS NOT NULL AND v_men_ant <> p_IdMensualidad THEN CALL usp_mensualidad_recalcular(v_men_ant); END IF;
    CALL usp_mensualidad_recalcular(p_IdMensualidad);
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
