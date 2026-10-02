USE `VoleyDB`;

-- Requerimiento 2.6: pagos parciales de ventas con historial de abonos.
-- VENTA.ACUENTA guarda siempre lo pagado hasta hoy (NULL = pagado completo al emitir);
-- VENTA_ABONO guarda cada pago: el inicial ('Inicial') y los posteriores ('Abono').
-- Requiere 06_usp_operacion.sql y 08_usp_requerimientos.sql. Se puede ejecutar varias veces.

CREATE TABLE IF NOT EXISTS VENTA_ABONO (
    IDABONO VARCHAR(50) NOT NULL PRIMARY KEY,
    IDVENTA VARCHAR(50) NOT NULL,
    FECHA CHAR(8) NOT NULL,
    MONTO DECIMAL(10,2) NOT NULL,
    MEDIO VARCHAR(30) NOT NULL DEFAULT 'Efectivo',
    ORIGEN VARCHAR(20) NOT NULL DEFAULT 'Abono',
    OBSERVACION VARCHAR(300) NULL,
    IDUSUARIO VARCHAR(50) NULL,
    FECHAREGISTRO CHAR(8) NULL,
    HORAREGISTRO CHAR(8) NULL,
    INDEX IX_ABONO_VENTA (IDVENTA),
    CONSTRAINT FK_ABONO_VENTA FOREIGN KEY (IDVENTA) REFERENCES VENTA(IDVENTA) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO VENTA_ABONO (IDABONO, IDVENTA, FECHA, MONTO, MEDIO, ORIGEN, IDUSUARIO, FECHAREGISTRO, HORAREGISTRO)
SELECT CONCAT('ABO', LPAD(b.BASE + ROW_NUMBER() OVER (ORDER BY v.IDVENTA), 6, '0')),
       v.IDVENTA, IFNULL(v.FECHA, DATE_FORMAT(NOW(), '%d%m%Y')), v.ACUENTA, IFNULL(v.MEDIO, 'Efectivo'), 'Inicial',
       v.USUARIO_EMISION, v.FECHA_EMISION, v.HORA_EMISION
FROM VENTA v
CROSS JOIN (SELECT IFNULL(MAX(CAST(SUBSTRING(IDABONO, 4) AS UNSIGNED)), 0) AS BASE FROM VENTA_ABONO) b
WHERE v.ACUENTA IS NOT NULL AND v.ACUENTA > 0
  AND NOT EXISTS (SELECT 1 FROM VENTA_ABONO x WHERE x.IDVENTA = v.IDVENTA);

DROP PROCEDURE IF EXISTS usp_venta_abono_sincronizar;
DROP PROCEDURE IF EXISTS usp_venta_abono_listar;
DROP PROCEDURE IF EXISTS usp_venta_abono_insertar;
DROP PROCEDURE IF EXISTS usp_venta_abono_eliminar;

DELIMITER $$

-- Mientras la venta no tenga abonos posteriores, el pago inicial refleja lo que se puso "a cuenta" al emitir.
CREATE PROCEDURE usp_venta_abono_sincronizar(IN p_IdVenta VARCHAR(50), IN p_Usuario VARCHAR(50))
proc: BEGIN
    DECLARE v_acuenta DECIMAL(10,2);
    DECLARE v_fecha CHAR(8);
    DECLARE v_medio VARCHAR(30);
    DECLARE v_id VARCHAR(50);
    IF EXISTS (SELECT 1 FROM VENTA_ABONO WHERE IDVENTA = p_IdVenta AND ORIGEN = 'Abono') THEN
        LEAVE proc;
    END IF;
    DELETE FROM VENTA_ABONO WHERE IDVENTA = p_IdVenta AND ORIGEN = 'Inicial';
    SELECT ACUENTA, FECHA, MEDIO INTO v_acuenta, v_fecha, v_medio FROM VENTA WHERE IDVENTA = p_IdVenta;
    IF v_acuenta IS NULL OR v_acuenta <= 0 THEN
        LEAVE proc;
    END IF;
    SELECT CONCAT('ABO', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDABONO, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM VENTA_ABONO;
    INSERT INTO VENTA_ABONO (IDABONO, IDVENTA, FECHA, MONTO, MEDIO, ORIGEN, IDUSUARIO, FECHAREGISTRO, HORAREGISTRO)
    VALUES (v_id, p_IdVenta, IFNULL(v_fecha, DATE_FORMAT(NOW(), '%d%m%Y')), v_acuenta, IFNULL(v_medio, 'Efectivo'),
            'Inicial', NULLIF(TRIM(IFNULL(p_Usuario, '')), ''), DATE_FORMAT(NOW(), '%d%m%Y'), DATE_FORMAT(NOW(), '%H:%i:%s'));
END$$

-- Una venta pagada completa al emitir no tiene filas en VENTA_ABONO; se muestra como un solo pago.
CREATE PROCEDURE usp_venta_abono_listar(IN p_IdVenta VARCHAR(50))
BEGIN
    SELECT ab.IDABONO, ab.FECHA, ab.MONTO, ab.MEDIO, ab.ORIGEN, ab.OBSERVACION,
           ab.IDUSUARIO, ab.FECHAREGISTRO, LEFT(ab.HORAREGISTRO, 5) AS HORAREGISTRO
    FROM VENTA_ABONO ab
    WHERE ab.IDVENTA = p_IdVenta
    UNION ALL
    SELECT NULL, v.FECHA, v.PRECIO, v.MEDIO, 'Pago completo', NULL,
           v.USUARIO_EMISION, v.FECHA_EMISION, LEFT(v.HORA_EMISION, 5)
    FROM VENTA v
    WHERE v.IDVENTA = p_IdVenta AND v.ACUENTA IS NULL AND v.PRECIO > 0
      AND NOT EXISTS (SELECT 1 FROM VENTA_ABONO x WHERE x.IDVENTA = v.IDVENTA)
    ORDER BY STR_TO_DATE(FECHA, '%d%m%Y'), FECHAREGISTRO, HORAREGISTRO, IDABONO;
END$$

CREATE PROCEDURE usp_venta_abono_insertar(
    IN p_IdVenta VARCHAR(50), IN p_Fecha CHAR(8), IN p_Monto DECIMAL(10,2), IN p_Medio VARCHAR(30),
    IN p_Observacion VARCHAR(300),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_precio DECIMAL(10,2);
    DECLARE v_acuenta DECIMAL(10,2);
    DECLARE v_saldo DECIMAL(10,2);
    DECLARE v_alumna VARCHAR(50);
    DECLARE v_numero VARCHAR(30);
    DECLARE v_id VARCHAR(50);
    IF NOT EXISTS (SELECT 1 FROM VENTA WHERE IDVENTA = p_IdVenta) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'No se encontró la venta.'; LEAVE proc;
    END IF;
    SELECT ESTADO_RECIBO, PRECIO, ACUENTA, IDALUMNA, IFNULL(COMPROBANTE, IDVENTA)
      INTO v_estado, v_precio, v_acuenta, v_alumna, v_numero
      FROM VENTA WHERE IDVENTA = p_IdVenta;
    IF v_estado <> 'Emitido' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Solo se registran abonos en recibos emitidos.'; LEAVE proc;
    END IF;
    SET v_saldo = GREATEST(v_precio - IFNULL(v_acuenta, v_precio), 0);
    IF v_saldo <= 0 THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Esta venta no tiene saldo pendiente.'; LEAVE proc;
    END IF;
    IF p_Monto IS NULL OR p_Monto <= 0 THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa un monto mayor a cero.'; LEAVE proc;
    END IF;
    IF p_Monto > v_saldo THEN
        SET p_Resultado = 0;
        SET p_Mensaje = CONCAT('El abono supera el saldo pendiente (S/ ', FORMAT(v_saldo, 2), ').');
        LEAVE proc;
    END IF;
    CALL usp_venta_abono_sincronizar(p_IdVenta, @app_usuario);
    SELECT CONCAT('ABO', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDABONO, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM VENTA_ABONO;
    INSERT INTO VENTA_ABONO (IDABONO, IDVENTA, FECHA, MONTO, MEDIO, ORIGEN, OBSERVACION, IDUSUARIO, FECHAREGISTRO, HORAREGISTRO)
    VALUES (v_id, p_IdVenta, IFNULL(NULLIF(p_Fecha, ''), DATE_FORMAT(NOW(), '%d%m%Y')), p_Monto,
            IFNULL(NULLIF(p_Medio, ''), 'Efectivo'), 'Abono', NULLIF(TRIM(IFNULL(p_Observacion, '')), ''),
            NULLIF(TRIM(IFNULL(@app_usuario, '')), ''), DATE_FORMAT(NOW(), '%d%m%Y'), DATE_FORMAT(NOW(), '%H:%i:%s'));
    UPDATE VENTA SET ACUENTA = IFNULL(ACUENTA, 0) + p_Monto WHERE IDVENTA = p_IdVenta;
    SET v_saldo = v_saldo - p_Monto;
    CALL usp_auditoria_registrar('VENTA', p_IdVenta, v_alumna, 'Abono',
         CONCAT('Recibo ', v_numero, ': abono S/ ', FORMAT(p_Monto, 2), '. Saldo S/ ', FORMAT(v_saldo, 2)));
    SET p_Resultado = 1;
    SET p_Mensaje = IF(v_saldo <= 0,
                       CONCAT('Abono registrado. El recibo ', v_numero, ' quedó pagado.'),
                       CONCAT('Abono registrado. Saldo pendiente S/ ', FORMAT(v_saldo, 2), '.'));
END$$

-- Solo se anulan abonos posteriores; el pago inicial se corrige editando la venta.
CREATE PROCEDURE usp_venta_abono_eliminar(
    IN p_IdAbono VARCHAR(50),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_venta VARCHAR(50);
    DECLARE v_monto DECIMAL(10,2);
    DECLARE v_origen VARCHAR(20);
    DECLARE v_alumna VARCHAR(50);
    DECLARE v_numero VARCHAR(30);
    SELECT IDVENTA, MONTO, ORIGEN INTO v_venta, v_monto, v_origen FROM VENTA_ABONO WHERE IDABONO = p_IdAbono;
    IF v_venta IS NULL THEN
        SET p_Resultado = 0; SET p_Mensaje = 'No se encontró el abono.'; LEAVE proc;
    END IF;
    IF v_origen <> 'Abono' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'El pago inicial se corrige editando la venta.'; LEAVE proc;
    END IF;
    IF (SELECT ESTADO_RECIBO FROM VENTA WHERE IDVENTA = v_venta) <> 'Emitido' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'El recibo ya no está emitido.'; LEAVE proc;
    END IF;
    SELECT IDALUMNA, IFNULL(COMPROBANTE, IDVENTA) INTO v_alumna, v_numero FROM VENTA WHERE IDVENTA = v_venta;
    DELETE FROM VENTA_ABONO WHERE IDABONO = p_IdAbono;
    UPDATE VENTA SET ACUENTA = GREATEST(IFNULL(ACUENTA, PRECIO) - v_monto, 0) WHERE IDVENTA = v_venta;
    CALL usp_auditoria_registrar('VENTA', v_venta, v_alumna, 'Abono anulado',
         CONCAT('Recibo ', v_numero, ': se anuló el abono ', p_IdAbono, ' de S/ ', FORMAT(v_monto, 2)));
    SET p_Resultado = 1; SET p_Mensaje = 'Abono anulado. El saldo se recalculó.';
END$$

DELIMITER ;
