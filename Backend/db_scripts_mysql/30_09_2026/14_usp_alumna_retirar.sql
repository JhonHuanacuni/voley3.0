USE `VoleyDB`;

-- Retira a una alumna activa o inactiva. La ficha, la matrícula y los pagos se conservan.
-- La auditoría (trigger de ALUMNA) registra el cambio de estado como Retirado.
-- Se puede volver a ejecutar: si ya está retirada, no modifica nada.

DROP PROCEDURE IF EXISTS usp_alumna_retirar;

DELIMITER $$

CREATE PROCEDURE usp_alumna_retirar(
    IN p_Id VARCHAR(50),
    IN p_Fecha CHAR(8),
    IN p_Motivo VARCHAR(500),
    OUT p_Resultado INT,
    OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    IF NOT EXISTS (SELECT 1 FROM ALUMNA WHERE IDALUMNA = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La alumna no existe.'; LEAVE proc;
    END IF;
    IF EXISTS (SELECT 1 FROM ALUMNA WHERE IDALUMNA = p_Id AND ESTADO = 'Retirada') THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La alumna ya está retirada.'; LEAVE proc;
    END IF;
    UPDATE ALUMNA
       SET ESTADO = 'Retirada',
           FECHARETIRO = IFNULL(NULLIF(TRIM(IFNULL(p_Fecha, '')), ''), DATE_FORMAT(NOW(), '%d%m%Y')),
           MOTIVORETIRO = NULLIF(TRIM(IFNULL(p_Motivo, '')), '')
     WHERE IDALUMNA = p_Id;
    SET p_Resultado = 1;
    SET p_Mensaje = 'Alumna retirada. Queda en Retiradas y se puede reactivar después.';
END$$

DELIMITER ;
