USE `VoleyDB`;

-- usp_venta_insertar ahora devuelve el ID de la venta creada (p_Id).
-- Misma lógica que en 06_usp_operacion.sql; se puede volver a ejecutar sin perder datos.

DROP PROCEDURE IF EXISTS usp_venta_insertar;

DELIMITER $$

CREATE PROCEDURE usp_venta_insertar(
    IN p_Nombre VARCHAR(200), IN p_Producto VARCHAR(150), IN p_Tipo VARCHAR(30), IN p_IdTurno VARCHAR(50),
    IN p_Talla VARCHAR(5), IN p_Obs VARCHAR(500), IN p_Precio DECIMAL(10,2), IN p_Medio VARCHAR(30),
    IN p_Fecha CHAR(8), IN p_Lineas TEXT, IN p_ACuenta DECIMAL(10,2), IN p_Usuario VARCHAR(50),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200), OUT p_Id VARCHAR(50)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    DECLARE v_tipo VARCHAR(30);
    DECLARE v_cmp VARCHAR(30);
    DECLARE v_lineas INT DEFAULT 0;
    DECLARE v_usuario VARCHAR(50);
    SET p_Id = NULL;
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
    SET p_Id = v_id;
    IF v_tipo = 'Servicio' THEN
        SET p_Mensaje = CONCAT('Comprobante ', v_cmp, ' emitido. No se creó ni modificó ninguna mensualidad.');
    ELSE
        SET p_Mensaje = 'Venta registrada.';
    END IF;
END$$

DELIMITER ;
