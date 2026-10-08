USE `VoleyDB`;

-- Reactivar una alumna retirada o inactiva. Se puede volver a ejecutar sin perder datos.
-- La fecha y el motivo del retiro anterior quedan en AUDITORIA (trigger de ALUMNA).

DROP PROCEDURE IF EXISTS usp_alumna_reactivar;

DELIMITER $$

CREATE PROCEDURE usp_alumna_reactivar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
proc: BEGIN
    IF NOT EXISTS (SELECT 1 FROM ALUMNA WHERE IDALUMNA = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La alumna no existe.'; LEAVE proc;
    END IF;
    IF EXISTS (SELECT 1 FROM ALUMNA WHERE IDALUMNA = p_Id AND ESTADO = 'Activa') THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La alumna ya está activa.'; LEAVE proc;
    END IF;
    UPDATE ALUMNA SET ESTADO = 'Activa', MOTIVORETIRO = NULL, FECHARETIRO = NULL WHERE IDALUMNA = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Alumna reactivada. Registra su nueva mensualidad cuando vuelva a pagar.';
END$$

DELIMITER ;
