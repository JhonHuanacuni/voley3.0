USE `VoleyDB`;

-- Reportes con pestaña propia en el módulo Reportes (traídos de voley 2.0):
-- listado de alumnas, asistencia mensual, ingresos y egresos, historial de pagos.
-- También los gráficos del dashboard (asistencias por turno, ingresos y egresos por mes).
-- Requiere 08_usp_requerimientos.sql (usp_ordenar_temporal, fn_fecha_vista) y 09_ventas_abonos.sql.
-- Se puede ejecutar varias veces.

DROP FUNCTION IF EXISTS fn_ingresos_ventas;
DROP PROCEDURE IF EXISTS usp_reporte_alumnas;
DROP PROCEDURE IF EXISTS usp_reporte_asistencia_mensual;
DROP PROCEDURE IF EXISTS usp_reporte_financiero;
DROP PROCEDURE IF EXISTS usp_reporte_historial_pagos;
DROP PROCEDURE IF EXISTS usp_dashboard_asistencias;
DROP PROCEDURE IF EXISTS usp_dashboard_finanzas;

DELIMITER $$

-- Dinero cobrado por ventas emitidas en el rango (NULL = sin límite): ventas pagadas completas al emitir
-- por su fecha y cada abono por la fecha en que se pagó.
CREATE FUNCTION fn_ingresos_ventas(p_Desde DATE, p_Hasta DATE)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
    DECLARE v_contado DECIMAL(12,2);
    DECLARE v_abonos DECIMAL(12,2);

    SELECT IFNULL(SUM(v.PRECIO), 0) INTO v_contado
    FROM VENTA v
    WHERE v.ESTADO_RECIBO = 'Emitido' AND v.ACUENTA IS NULL
      AND NOT EXISTS (SELECT 1 FROM VENTA_ABONO x WHERE x.IDVENTA = v.IDVENTA)
      AND (p_Desde IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') >= p_Desde)
      AND (p_Hasta IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') <= p_Hasta);

    SELECT IFNULL(SUM(ab.MONTO), 0) INTO v_abonos
    FROM VENTA_ABONO ab
    INNER JOIN VENTA v ON v.IDVENTA = ab.IDVENTA
    WHERE v.ESTADO_RECIBO = 'Emitido'
      AND (p_Desde IS NULL OR STR_TO_DATE(ab.FECHA, '%d%m%Y') >= p_Desde)
      AND (p_Hasta IS NULL OR STR_TO_DATE(ab.FECHA, '%d%m%Y') <= p_Hasta);

    RETURN v_contado + v_abonos;
END$$

CREATE PROCEDURE usp_reporte_alumnas(
    IN p_Buscar VARCHAR(120), IN p_Estado VARCHAR(20), IN p_IdCiclo VARCHAR(50), IN p_IdTurno VARCHAR(50),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4)
)
BEGIN
    DECLARE v_buscar VARCHAR(122);
    SET v_buscar = IF(TRIM(IFNULL(p_Buscar, '')) = '', NULL, CONCAT('%', TRIM(p_Buscar), '%'));

    DROP TEMPORARY TABLE IF EXISTS tmp_reporte_alumnas;
    CREATE TEMPORARY TABLE tmp_reporte_alumnas AS
    SELECT a.IDALUMNA, UPPER(a.NOMBRE) AS ALUMNA, a.EDAD, a.DNI, a.EMAIL, a.TELEFONO,
           UPPER(c.NOMBRE) AS CICLO, UPPER(t.NOMBRE) AS TURNO,
           IF(t.IDTURNO IS NULL, NULL, CONCAT(t.HORAINICIO, ' - ', t.HORAFIN)) AS HORARIO,
           UPPER(IFNULL(NULLIF(a.DIASASISTENCIA, ''), t.DIASACTIVOS)) AS DIAS, a.ESTADO,
           IFNULL(NULLIF(a.MENSUALIDAD, 0), um.MONTO) AS CUOTA,
           a.FECHAINSCRIPCION,
           IFNULL(um.FECHAINICIO, a.INICIOMENSUALIDAD) AS FECHAINICIO,
           IFNULL(um.FECHAFIN, a.FINMENSUALIDAD) AS FECHAFIN,
           a.FECHARETIRO,
           ROW_NUMBER() OVER (ORDER BY a.NOMBRE, a.IDALUMNA) AS ORDEN
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
    LEFT JOIN (
        SELECT m.IDALUMNA, m.MONTO, m.FECHAINICIO, m.FECHAFIN,
               ROW_NUMBER() OVER (PARTITION BY m.IDALUMNA
                                  ORDER BY STR_TO_DATE(m.FECHAFIN, '%d%m%Y') DESC, m.IDMENSUALIDAD DESC) AS RN
        FROM MENSUALIDAD m
        WHERE m.ESTADO <> 'Inactivo'
    ) um ON um.IDALUMNA = a.IDALUMNA AND um.RN = 1
    WHERE (NULLIF(p_Estado, '') IS NULL OR a.ESTADO = p_Estado)
      AND (NULLIF(p_IdCiclo, '') IS NULL OR a.IDCICLO = p_IdCiclo)
      AND (NULLIF(p_IdTurno, '') IS NULL OR a.IDTURNO = p_IdTurno)
      AND (v_buscar IS NULL OR a.NOMBRE LIKE v_buscar OR a.DNI LIKE v_buscar
           OR a.TELEFONO LIKE v_buscar OR a.IDALUMNA LIKE v_buscar);

    CALL usp_ordenar_temporal('tmp_reporte_alumnas', p_OrdenarPor, p_Direccion);
    DROP TEMPORARY TABLE IF EXISTS tmp_reporte_alumnas;
END$$

-- Devuelve dos result sets: las alumnas del mes (ordenadas) y sus marcas de asistencia por día.
CREATE PROCEDURE usp_reporte_asistencia_mensual(
    IN p_Anio INT, IN p_Mes INT, IN p_Buscar VARCHAR(120), IN p_IdCiclo VARCHAR(50), IN p_IdTurno VARCHAR(50),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4)
)
BEGIN
    DECLARE v_ini DATE;
    DECLARE v_fin DATE;
    DECLARE v_buscar VARCHAR(122);

    IF p_Anio IS NULL OR p_Mes IS NULL OR p_Mes NOT BETWEEN 1 AND 12 OR p_Anio NOT BETWEEN 2000 AND 2100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mes no válido';
    END IF;
    SET v_ini = MAKEDATE(p_Anio, 1) + INTERVAL (p_Mes - 1) MONTH;
    SET v_fin = LAST_DAY(v_ini);
    SET v_buscar = IF(TRIM(IFNULL(p_Buscar, '')) = '', NULL, CONCAT('%', TRIM(p_Buscar), '%'));

    DROP TEMPORARY TABLE IF EXISTS tmp_asistencia_mes;
    CREATE TEMPORARY TABLE tmp_asistencia_mes AS
    SELECT a.IDALUMNA, UPPER(a.NOMBRE) AS ALUMNA, UPPER(a.APODERADO) AS APODERADO, a.TELAPODERADO, a.TELEFONO,
           UPPER(c.NOMBRE) AS CICLO, UPPER(t.NOMBRE) AS TURNO,
           IF(t.IDTURNO IS NULL, NULL, CONCAT(t.HORAINICIO, ' - ', t.HORAFIN)) AS HORARIO,
           a.ESTADO,
           IFNULL(s.PRESENTES, 0) AS PRESENTES, IFNULL(s.TARDES, 0) AS TARDES, IFNULL(s.FALTAS, 0) AS FALTAS,
           mm.MONTO AS MONTOMENSUALIDAD, mm.FECHAFIN AS FECHAFINMENSUALIDAD,
           IF(mm.IDMENSUALIDAD IS NULL, NULL, IFNULL(pg.PAGADO, 0)) AS PAGADO,
           IF(mm.IDMENSUALIDAD IS NULL, NULL, GREATEST(mm.MONTO - IFNULL(pg.PAGADO, 0), 0)) AS SALDO,
           ROW_NUMBER() OVER (ORDER BY t.NOMBRE, a.NOMBRE, a.IDALUMNA) AS ORDEN
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
    LEFT JOIN (
        SELECT IDALUMNA,
               SUM(ESTADO = 'Presente') AS PRESENTES,
               SUM(ESTADO = 'Tarde') AS TARDES,
               SUM(ESTADO = 'Ausente') AS FALTAS
        FROM ASISTENCIA
        WHERE STR_TO_DATE(FECHA, '%d%m%Y') BETWEEN v_ini AND v_fin
        GROUP BY IDALUMNA
    ) s ON s.IDALUMNA = a.IDALUMNA
    LEFT JOIN (
        SELECT m.IDALUMNA, m.IDMENSUALIDAD, m.MONTO, m.FECHAFIN,
               ROW_NUMBER() OVER (
                   PARTITION BY m.IDALUMNA
                   ORDER BY (STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') <= v_fin
                             AND STR_TO_DATE(m.FECHAFIN, '%d%m%Y') >= v_ini) DESC,
                            STR_TO_DATE(m.FECHAFIN, '%d%m%Y') DESC, m.IDMENSUALIDAD DESC) AS RN
        FROM MENSUALIDAD m
        WHERE m.ESTADO <> 'Inactivo'
    ) mm ON mm.IDALUMNA = a.IDALUMNA AND mm.RN = 1
    LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
           ON pg.IDMENSUALIDAD = mm.IDMENSUALIDAD
    WHERE (a.ESTADO = 'Activa' OR s.IDALUMNA IS NOT NULL)
      AND (NULLIF(p_IdCiclo, '') IS NULL OR a.IDCICLO = p_IdCiclo)
      AND (NULLIF(p_IdTurno, '') IS NULL OR a.IDTURNO = p_IdTurno)
      AND (v_buscar IS NULL OR a.NOMBRE LIKE v_buscar OR a.DNI LIKE v_buscar OR a.IDALUMNA LIKE v_buscar);

    CALL usp_ordenar_temporal('tmp_asistencia_mes', p_OrdenarPor, p_Direccion);

    SELECT s.IDALUMNA, DAY(STR_TO_DATE(s.FECHA, '%d%m%Y')) AS DIA, s.ESTADO
    FROM ASISTENCIA s
    INNER JOIN tmp_asistencia_mes t ON t.IDALUMNA = s.IDALUMNA
    WHERE STR_TO_DATE(s.FECHA, '%d%m%Y') BETWEEN v_ini AND v_fin;

    DROP TEMPORARY TABLE IF EXISTS tmp_asistencia_mes;
END$$

-- Devuelve dos result sets: el resumen del mes (una fila) y los egresos del mes (ordenados).
-- Mes anterior = todo lo cobrado menos todo lo gastado antes del mes. Utilidad = mes anterior + ingresos - egresos.
CREATE PROCEDURE usp_reporte_financiero(
    IN p_Anio INT, IN p_Mes INT, IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4)
)
BEGIN
    DECLARE v_ini DATE;
    DECLARE v_fin DATE;
    DECLARE v_pagos_antes DECIMAL(12,2);
    DECLARE v_egresos_antes DECIMAL(12,2);
    DECLARE v_pagos DECIMAL(12,2);
    DECLARE v_ventas DECIMAL(12,2);
    DECLARE v_egresos DECIMAL(12,2);
    DECLARE v_anterior DECIMAL(12,2);

    IF p_Anio IS NULL OR p_Mes IS NULL OR p_Mes NOT BETWEEN 1 AND 12 OR p_Anio NOT BETWEEN 2000 AND 2100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mes no válido';
    END IF;
    SET v_ini = MAKEDATE(p_Anio, 1) + INTERVAL (p_Mes - 1) MONTH;
    SET v_fin = LAST_DAY(v_ini);

    SELECT IFNULL(SUM(MONTO), 0) INTO v_pagos_antes FROM PAGO WHERE STR_TO_DATE(FECHA, '%d%m%Y') < v_ini;
    SELECT IFNULL(SUM(MONTO), 0) INTO v_egresos_antes FROM EGRESO WHERE STR_TO_DATE(FECHA, '%d%m%Y') < v_ini;
    SELECT IFNULL(SUM(MONTO), 0) INTO v_pagos FROM PAGO WHERE STR_TO_DATE(FECHA, '%d%m%Y') BETWEEN v_ini AND v_fin;
    SELECT IFNULL(SUM(MONTO), 0) INTO v_egresos FROM EGRESO WHERE STR_TO_DATE(FECHA, '%d%m%Y') BETWEEN v_ini AND v_fin;
    SET v_ventas = fn_ingresos_ventas(v_ini, v_fin);
    SET v_anterior = v_pagos_antes + fn_ingresos_ventas(NULL, v_ini - INTERVAL 1 DAY) - v_egresos_antes;

    SELECT DATE_FORMAT(v_ini, '%d%m%Y') AS FECHADESDE, DATE_FORMAT(v_fin, '%d%m%Y') AS FECHAHASTA,
           v_anterior AS MESANTERIOR, v_pagos AS PAGOS, v_ventas AS VENTAS, v_pagos + v_ventas AS INGRESOS,
           v_egresos AS EGRESOS, v_anterior + v_pagos + v_ventas - v_egresos AS UTILIDAD;

    DROP TEMPORARY TABLE IF EXISTS tmp_egresos_mes;
    CREATE TEMPORARY TABLE tmp_egresos_mes AS
    SELECT e.IDEGRESO, e.FECHA, UPPER(e.CONCEPTO) AS CONCEPTO, UPPER(e.PROVEEDOR) AS PROVEEDOR, e.MONTO,
           UPPER(e.MEDIO) AS MEDIO, UPPER(e.OBSERVACIONES) AS OBSERVACIONES,
           ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(e.FECHA, '%d%m%Y'), e.CONCEPTO, e.IDEGRESO) AS ORDEN
    FROM EGRESO e
    WHERE STR_TO_DATE(e.FECHA, '%d%m%Y') BETWEEN v_ini AND v_fin;

    CALL usp_ordenar_temporal('tmp_egresos_mes', p_OrdenarPor, p_Direccion);
    DROP TEMPORARY TABLE IF EXISTS tmp_egresos_mes;
END$$

-- Todo el dinero cobrado: pagos de mensualidades, ventas pagadas completas y abonos de ventas.
CREATE PROCEDURE usp_reporte_historial_pagos(
    IN p_Buscar VARCHAR(120), IN p_Tipo VARCHAR(20), IN p_Desde CHAR(8), IN p_Hasta CHAR(8),
    IN p_IdCiclo VARCHAR(50), IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4)
)
BEGIN
    DECLARE v_desde DATE;
    DECLARE v_hasta DATE;
    DECLARE v_ciclo VARCHAR(50);
    DECLARE v_tipo VARCHAR(20);
    DECLARE v_buscar VARCHAR(122);
    SET v_desde = STR_TO_DATE(NULLIF(p_Desde, ''), '%d%m%Y');
    SET v_hasta = STR_TO_DATE(NULLIF(p_Hasta, ''), '%d%m%Y');
    SET v_ciclo = NULLIF(p_IdCiclo, '');
    SET v_tipo = NULLIF(p_Tipo, '');
    SET v_buscar = IF(TRIM(IFNULL(p_Buscar, '')) = '', NULL, CONCAT('%', TRIM(p_Buscar), '%'));

    DROP TEMPORARY TABLE IF EXISTS tmp_historial_pagos;
    CREATE TEMPORARY TABLE tmp_historial_pagos AS
    SELECT x.*, ROW_NUMBER() OVER (ORDER BY STR_TO_DATE(x.FECHA, '%d%m%Y') DESC, x.CODIGO DESC) AS ORDEN
    FROM (
        SELECT p.FECHA, 'MENSUALIDAD' AS TIPO, p.IDPAGO AS CODIGO, a.IDALUMNA, UPPER(a.NOMBRE) AS ALUMNA,
               UPPER(c.NOMBRE) AS CICLO,
               IF(m.IDMENSUALIDAD IS NULL, NULL,
                  CONCAT('PERIODO ', fn_fecha_vista(m.FECHAINICIO), ' - ', fn_fecha_vista(m.FECHAFIN))) AS DETALLE,
               p.MONTO, UPPER(p.MEDIO) AS MEDIO, m.ESTADO
        FROM PAGO p
        INNER JOIN ALUMNA a ON a.IDALUMNA = p.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN MENSUALIDAD m ON m.IDMENSUALIDAD = p.IDMENSUALIDAD
        WHERE (v_tipo IS NULL OR v_tipo = 'mensualidades')
          AND (v_desde IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
          AND (v_buscar IS NULL OR a.NOMBRE LIKE v_buscar OR a.DNI LIKE v_buscar OR p.IDPAGO LIKE v_buscar)
        UNION ALL
        SELECT v.FECHA, IF(v.TIPO = 'Servicio', 'SERVICIO', 'VENTA') AS TIPO, IFNULL(v.COMPROBANTE, v.IDVENTA) AS CODIGO,
               v.IDALUMNA, UPPER(v.NOMBRE) AS ALUMNA, UPPER(c.NOMBRE) AS CICLO, UPPER(v.PRODUCTO) AS DETALLE,
               v.PRECIO AS MONTO, UPPER(v.MEDIO) AS MEDIO, 'Pagado' AS ESTADO
        FROM VENTA v
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        WHERE v.ESTADO_RECIBO = 'Emitido' AND v.ACUENTA IS NULL
          AND NOT EXISTS (SELECT 1 FROM VENTA_ABONO x WHERE x.IDVENTA = v.IDVENTA)
          AND (v_tipo IS NULL OR v_tipo = 'ventas')
          AND (v_desde IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
          AND (v_buscar IS NULL OR v.NOMBRE LIKE v_buscar OR a.DNI LIKE v_buscar
               OR v.COMPROBANTE LIKE v_buscar OR v.IDVENTA LIKE v_buscar)
        UNION ALL
        SELECT ab.FECHA, IF(ab.ORIGEN = 'Inicial', 'PAGO INICIAL DE VENTA', 'ABONO DE VENTA') AS TIPO,
               IFNULL(v.COMPROBANTE, v.IDVENTA) AS CODIGO, v.IDALUMNA, UPPER(v.NOMBRE) AS ALUMNA,
               UPPER(c.NOMBRE) AS CICLO, UPPER(v.PRODUCTO) AS DETALLE, ab.MONTO, UPPER(ab.MEDIO) AS MEDIO,
               IF(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO) > 0, 'Con saldo', 'Pagado') AS ESTADO
        FROM VENTA_ABONO ab
        INNER JOIN VENTA v ON v.IDVENTA = ab.IDVENTA
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        WHERE v.ESTADO_RECIBO = 'Emitido'
          AND (v_tipo IS NULL OR v_tipo = 'ventas')
          AND (v_desde IS NULL OR STR_TO_DATE(ab.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(ab.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
          AND (v_buscar IS NULL OR v.NOMBRE LIKE v_buscar OR a.DNI LIKE v_buscar
               OR v.COMPROBANTE LIKE v_buscar OR v.IDVENTA LIKE v_buscar)
    ) x;

    CALL usp_ordenar_temporal('tmp_historial_pagos', p_OrdenarPor, p_Direccion);
    DROP TEMPORARY TABLE IF EXISTS tmp_historial_pagos;
END$$

-- Asistencias del rango agrupadas por el turno actual de la alumna (sin turno al final).
CREATE PROCEDURE usp_dashboard_asistencias(IN p_Desde CHAR(8), IN p_Hasta CHAR(8), IN p_IdTurno VARCHAR(50))
BEGIN
    SELECT IFNULL(t.NOMBRE, 'Sin turno') AS TURNO, t.HORAINICIO, t.HORAFIN,
           SUM(s.ESTADO = 'Presente') AS PRESENTES,
           SUM(s.ESTADO = 'Ausente') AS FALTAS,
           SUM(s.ESTADO = 'Tarde') AS TARDANZAS,
           COUNT(DISTINCT s.IDALUMNA) AS ALUMNAS
    FROM ASISTENCIA s
    INNER JOIN ALUMNA a ON a.IDALUMNA = s.IDALUMNA
    LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
    WHERE STR_TO_DATE(s.FECHA, '%d%m%Y') BETWEEN STR_TO_DATE(p_Desde, '%d%m%Y') AND STR_TO_DATE(p_Hasta, '%d%m%Y')
      AND (IFNULL(p_IdTurno, '') = '' OR a.IDTURNO = p_IdTurno)
    GROUP BY t.IDTURNO, t.NOMBRE, t.HORAINICIO, t.HORAFIN
    ORDER BY t.IDTURNO IS NULL, t.HORAINICIO, t.NOMBRE;
END$$

-- Pagos de mensualidades, cobros de ventas y egresos de los últimos p_Meses meses (incluido el actual).
CREATE PROCEDURE usp_dashboard_finanzas(IN p_Meses INT)
BEGIN
    DECLARE v_meses INT;
    DECLARE v_ini DATE;
    SET v_meses = LEAST(GREATEST(IFNULL(p_Meses, 6), 1), 24);
    SET v_ini = DATE_FORMAT(CURDATE(), '%Y-%m-01') - INTERVAL (v_meses - 1) MONTH;

    WITH RECURSIVE meses (INICIO, N) AS (
        SELECT v_ini, 1
        UNION ALL
        SELECT INICIO + INTERVAL 1 MONTH, N + 1 FROM meses WHERE N < v_meses
    )
    SELECT DATE_FORMAT(m.INICIO, '%Y-%m') AS MES,
           (SELECT IFNULL(SUM(p.MONTO), 0) FROM PAGO p
             WHERE STR_TO_DATE(p.FECHA, '%d%m%Y') BETWEEN m.INICIO AND LAST_DAY(m.INICIO)) AS PAGOS,
           fn_ingresos_ventas(m.INICIO, LAST_DAY(m.INICIO)) AS VENTAS,
           (SELECT IFNULL(SUM(e.MONTO), 0) FROM EGRESO e
             WHERE STR_TO_DATE(e.FECHA, '%d%m%Y') BETWEEN m.INICIO AND LAST_DAY(m.INICIO)) AS EGRESOS
    FROM meses m
    ORDER BY m.INICIO;
END$$

DELIMITER ;
