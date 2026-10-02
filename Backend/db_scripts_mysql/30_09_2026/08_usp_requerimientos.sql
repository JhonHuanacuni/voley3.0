USE `VoleyDB`;

-- Requerimientos 2.12 a 2.23: trazabilidad, promociones, permisos por función y consultas.
-- Requiere 07_esquema_requerimientos.sql. El usuario que opera llega en la variable de sesión @app_usuario.

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

DROP PROCEDURE IF EXISTS usp_auditoria_registrar;
DROP PROCEDURE IF EXISTS usp_trazabilidad;
DROP PROCEDURE IF EXISTS usp_promocion_listar;
DROP PROCEDURE IF EXISTS usp_promocion_obtener;
DROP PROCEDURE IF EXISTS usp_promocion_insertar;
DROP PROCEDURE IF EXISTS usp_promocion_actualizar;
DROP PROCEDURE IF EXISTS usp_promocion_eliminar;
DROP PROCEDURE IF EXISTS usp_usuario_funciones_listar;
DROP PROCEDURE IF EXISTS usp_usuario_funciones_guardar;
DROP PROCEDURE IF EXISTS usp_cumpleanos_listar;
DROP PROCEDURE IF EXISTS usp_alumna_buscar_general;
DROP PROCEDURE IF EXISTS usp_estado_cuenta;
DROP PROCEDURE IF EXISTS usp_deudas;
DROP PROCEDURE IF EXISTS usp_reporte;

DROP TRIGGER IF EXISTS trg_alumna_ai;
DROP TRIGGER IF EXISTS trg_alumna_au;
DROP TRIGGER IF EXISTS trg_alumna_ad;
DROP TRIGGER IF EXISTS trg_mensualidad_ai;
DROP TRIGGER IF EXISTS trg_mensualidad_au;
DROP TRIGGER IF EXISTS trg_mensualidad_ad;
DROP TRIGGER IF EXISTS trg_pago_ai;
DROP TRIGGER IF EXISTS trg_pago_au;
DROP TRIGGER IF EXISTS trg_pago_ad;
DROP TRIGGER IF EXISTS trg_egreso_ai;
DROP TRIGGER IF EXISTS trg_egreso_au;
DROP TRIGGER IF EXISTS trg_egreso_ad;
DROP TRIGGER IF EXISTS trg_usuario_ai;
DROP TRIGGER IF EXISTS trg_usuario_au;
DROP TRIGGER IF EXISTS trg_usuario_ad;
DROP TRIGGER IF EXISTS trg_promocion_ai;
DROP TRIGGER IF EXISTS trg_promocion_au;
DROP TRIGGER IF EXISTS trg_promocion_ad;

DELIMITER $$

CREATE PROCEDURE usp_auditoria_registrar(
    IN p_Tabla VARCHAR(100), IN p_IdRegistro VARCHAR(50), IN p_IdAlumna VARCHAR(50),
    IN p_Accion VARCHAR(20), IN p_Detalle VARCHAR(500)
)
BEGIN
    DECLARE v_id VARCHAR(50);
    SELECT CONCAT('AUD', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDAUDITORIA, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM AUDITORIA;
    INSERT INTO AUDITORIA (IDAUDITORIA, TABLA, IDREGISTRO, IDALUMNA, ACCION, IDUSUARIO, FECHA, HORA, DETALLE)
    VALUES (v_id, p_Tabla, IFNULL(p_IdRegistro, ''), p_IdAlumna, p_Accion, NULLIF(TRIM(IFNULL(@app_usuario, '')), ''),
            DATE_FORMAT(NOW(), '%d%m%Y'), DATE_FORMAT(NOW(), '%H:%i:%s'), LEFT(p_Detalle, 500));
END$$

CREATE TRIGGER trg_alumna_ai AFTER INSERT ON ALUMNA FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('ALUMNA', NEW.IDALUMNA, NEW.IDALUMNA, 'Matrícula',
        CONCAT('Matrícula de ', NEW.NOMBRE,
               IF(NEW.FECHAINSCRIPCION IS NULL, '', CONCAT(' con inscripción del ', fn_fecha_vista(NEW.FECHAINSCRIPCION)))));
END$$

CREATE TRIGGER trg_alumna_au AFTER UPDATE ON ALUMNA FOR EACH ROW
BEGIN
    IF NOT (NEW.NOMBRE <=> OLD.NOMBRE AND NEW.DNI <=> OLD.DNI AND NEW.EMAIL <=> OLD.EMAIL
            AND NEW.TELEFONO <=> OLD.TELEFONO AND NEW.IDCICLO <=> OLD.IDCICLO AND NEW.IDTURNO <=> OLD.IDTURNO
            AND NEW.CONDICION <=> OLD.CONDICION AND NEW.ESTADO <=> OLD.ESTADO AND NEW.MENSUALIDAD <=> OLD.MENSUALIDAD
            AND NEW.FECHAINSCRIPCION <=> OLD.FECHAINSCRIPCION AND NEW.FECHANACIMIENTO <=> OLD.FECHANACIMIENTO
            AND NEW.APODERADO <=> OLD.APODERADO AND NEW.TELAPODERADO <=> OLD.TELAPODERADO
            AND NEW.DIRECCION <=> OLD.DIRECCION AND NEW.FECHARETIRO <=> OLD.FECHARETIRO
            AND NEW.MOTIVORETIRO <=> OLD.MOTIVORETIRO AND NEW.UNIFORMEENTREGADO <=> OLD.UNIFORMEENTREGADO) THEN
        CALL usp_auditoria_registrar('ALUMNA', NEW.IDALUMNA, NEW.IDALUMNA,
            IF(NOT (NEW.ESTADO <=> OLD.ESTADO) AND NEW.ESTADO = 'Retirada', 'Retirado', 'Modificado'),
            CONCAT('Ficha de ', NEW.NOMBRE,
                   IF(NEW.ESTADO <=> OLD.ESTADO, '', CONCAT(' · estado ', IFNULL(OLD.ESTADO, ''), ' → ', IFNULL(NEW.ESTADO, ''))),
                   IF(NEW.IDCICLO <=> OLD.IDCICLO, '', ' · cambio de categoría')));
    END IF;
END$$

CREATE TRIGGER trg_alumna_ad AFTER DELETE ON ALUMNA FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('ALUMNA', OLD.IDALUMNA, OLD.IDALUMNA, 'Eliminado', CONCAT('Alumna ', OLD.NOMBRE));
END$$

CREATE TRIGGER trg_mensualidad_ai AFTER INSERT ON MENSUALIDAD FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('MENSUALIDAD', NEW.IDMENSUALIDAD, NEW.IDALUMNA, 'Registrado',
        CONCAT(IF(NEW.ESTADO = 'Inactivo', 'Periodo inactivo de ', 'Mensualidad de '),
               IFNULL((SELECT NOMBRE FROM ALUMNA WHERE IDALUMNA = NEW.IDALUMNA), NEW.IDALUMNA),
               ' del ', fn_fecha_vista(NEW.FECHAINICIO), ' al ', fn_fecha_vista(NEW.FECHAFIN),
               ' por S/ ', FORMAT(NEW.MONTO, 2),
               IF(NEW.IDRENOVADA IS NULL, '', CONCAT(' (renovación de ', NEW.IDRENOVADA, ')'))));
END$$

CREATE TRIGGER trg_mensualidad_au AFTER UPDATE ON MENSUALIDAD FOR EACH ROW
BEGIN
    IF NOT (NEW.IDALUMNA <=> OLD.IDALUMNA AND NEW.FECHAINICIO <=> OLD.FECHAINICIO AND NEW.FECHAFIN <=> OLD.FECHAFIN
            AND NEW.MONTO <=> OLD.MONTO AND NEW.MONTOREGULAR <=> OLD.MONTOREGULAR AND NEW.NOTAS <=> OLD.NOTAS
            AND NEW.IDPROMOCION <=> OLD.IDPROMOCION)
       OR ((NEW.ESTADO = 'Inactivo') <> (OLD.ESTADO = 'Inactivo')) THEN
        CALL usp_auditoria_registrar('MENSUALIDAD', NEW.IDMENSUALIDAD, NEW.IDALUMNA, 'Modificado',
            CONCAT('Mensualidad del ', fn_fecha_vista(NEW.FECHAINICIO), ' al ', fn_fecha_vista(NEW.FECHAFIN),
                   ' por S/ ', FORMAT(NEW.MONTO, 2),
                   IF(NEW.MONTO <=> OLD.MONTO, '', CONCAT(' (antes S/ ', FORMAT(OLD.MONTO, 2), ')')),
                   IF((NEW.ESTADO = 'Inactivo') <> (OLD.ESTADO = 'Inactivo'),
                      IF(NEW.ESTADO = 'Inactivo', ' · marcado como periodo inactivo', ' · reactivado'), '')));
    END IF;
END$$

CREATE TRIGGER trg_mensualidad_ad AFTER DELETE ON MENSUALIDAD FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('MENSUALIDAD', OLD.IDMENSUALIDAD, OLD.IDALUMNA, 'Eliminado',
        CONCAT('Mensualidad del ', fn_fecha_vista(OLD.FECHAINICIO), ' al ', fn_fecha_vista(OLD.FECHAFIN),
               ' por S/ ', FORMAT(OLD.MONTO, 2)));
END$$

CREATE TRIGGER trg_pago_ai AFTER INSERT ON PAGO FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('PAGO', NEW.IDPAGO, NEW.IDALUMNA, 'Registrado',
        CONCAT('Pago de S/ ', FORMAT(NEW.MONTO, 2), ' (', NEW.MEDIO, ') de ',
               IFNULL((SELECT NOMBRE FROM ALUMNA WHERE IDALUMNA = NEW.IDALUMNA), NEW.IDALUMNA),
               IFNULL((SELECT CONCAT(' para el periodo ', fn_fecha_vista(FECHAINICIO), ' al ', fn_fecha_vista(FECHAFIN))
                         FROM MENSUALIDAD WHERE IDMENSUALIDAD = NEW.IDMENSUALIDAD), '')));
END$$

CREATE TRIGGER trg_pago_au AFTER UPDATE ON PAGO FOR EACH ROW
BEGIN
    IF NOT (NEW.MONTO <=> OLD.MONTO AND NEW.FECHA <=> OLD.FECHA AND NEW.MEDIO <=> OLD.MEDIO
            AND NEW.IDMENSUALIDAD <=> OLD.IDMENSUALIDAD AND NEW.IDALUMNA <=> OLD.IDALUMNA) THEN
        CALL usp_auditoria_registrar('PAGO', NEW.IDPAGO, NEW.IDALUMNA, 'Modificado',
            CONCAT('Pago de S/ ', FORMAT(NEW.MONTO, 2),
                   IF(NEW.MONTO <=> OLD.MONTO, '', CONCAT(' (antes S/ ', FORMAT(OLD.MONTO, 2), ')')),
                   IF(NEW.IDMENSUALIDAD <=> OLD.IDMENSUALIDAD, '', CONCAT(' · cambió de periodo ', IFNULL(OLD.IDMENSUALIDAD, '—'),
                                                                     ' a ', IFNULL(NEW.IDMENSUALIDAD, '—')))));
    END IF;
END$$

CREATE TRIGGER trg_pago_ad AFTER DELETE ON PAGO FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('PAGO', OLD.IDPAGO, OLD.IDALUMNA, 'Eliminado',
        CONCAT('Pago de S/ ', FORMAT(OLD.MONTO, 2), ' del ', fn_fecha_vista(OLD.FECHA)));
END$$

CREATE TRIGGER trg_egreso_ai AFTER INSERT ON EGRESO FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('EGRESO', NEW.IDEGRESO, NULL, 'Registrado',
        CONCAT(NEW.CONCEPTO, ' por S/ ', FORMAT(NEW.MONTO, 2)));
END$$

CREATE TRIGGER trg_egreso_au AFTER UPDATE ON EGRESO FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('EGRESO', NEW.IDEGRESO, NULL, 'Modificado',
        CONCAT(NEW.CONCEPTO, ' por S/ ', FORMAT(NEW.MONTO, 2),
               IF(NEW.MONTO <=> OLD.MONTO, '', CONCAT(' (antes S/ ', FORMAT(OLD.MONTO, 2), ')'))));
END$$

CREATE TRIGGER trg_egreso_ad AFTER DELETE ON EGRESO FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('EGRESO', OLD.IDEGRESO, NULL, 'Eliminado',
        CONCAT(OLD.CONCEPTO, ' por S/ ', FORMAT(OLD.MONTO, 2)));
END$$

CREATE TRIGGER trg_usuario_ai AFTER INSERT ON USUARIO FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('USUARIO', NEW.IDUSUARIO, NULL, 'Registrado',
        CONCAT('Usuario ', NEW.IDUSUARIO, ' (', IFNULL(NEW.NOMBRE, ''), ' ', IFNULL(NEW.APELLIDO, ''), ')'));
END$$

CREATE TRIGGER trg_usuario_au AFTER UPDATE ON USUARIO FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('USUARIO', NEW.IDUSUARIO, NULL, 'Modificado',
        CONCAT('Usuario ', NEW.IDUSUARIO,
               IF(NEW.CONTRA <=> OLD.CONTRA, '', ' · cambio de contraseña'),
               IF(NEW.IDTIPOUSUARIO <=> OLD.IDTIPOUSUARIO, '', ' · cambio de tipo'),
               IF(NEW.ESTADO <=> OLD.ESTADO, '', CONCAT(' · estado ', NEW.ESTADO))));
END$$

CREATE TRIGGER trg_usuario_ad AFTER DELETE ON USUARIO FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('USUARIO', OLD.IDUSUARIO, NULL, 'Eliminado', CONCAT('Usuario ', OLD.IDUSUARIO));
END$$

CREATE TRIGGER trg_promocion_ai AFTER INSERT ON PROMOCION FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('PROMOCION', NEW.IDPROMOCION, NULL, 'Registrado', CONCAT('Promoción ', NEW.NOMBRE));
END$$

CREATE TRIGGER trg_promocion_au AFTER UPDATE ON PROMOCION FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('PROMOCION', NEW.IDPROMOCION, NULL, 'Modificado', CONCAT('Promoción ', NEW.NOMBRE));
END$$

CREATE TRIGGER trg_promocion_ad AFTER DELETE ON PROMOCION FOR EACH ROW
BEGIN
    CALL usp_auditoria_registrar('PROMOCION', OLD.IDPROMOCION, NULL, 'Eliminado', CONCAT('Promoción ', OLD.NOMBRE));
END$$

CREATE PROCEDURE usp_trazabilidad(IN p_Tabla VARCHAR(100), IN p_Id VARCHAR(50))
BEGIN
    SELECT IDAUDITORIA, FECHA, HORA, IDUSUARIO, ACCION, DETALLE
    FROM AUDITORIA
    WHERE TABLA = p_Tabla AND IDREGISTRO = p_Id
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

CREATE PROCEDURE usp_alumna_buscar_general(IN p_Texto VARCHAR(100))
BEGIN
    DECLARE v_t VARCHAR(100);
    SET v_t = TRIM(IFNULL(p_Texto, ''));
    SELECT a.IDALUMNA, a.NOMBRE, a.DNI, a.TELEFONO, a.TELAPODERADO, a.ESTADO, c.NOMBRE AS CICLO
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

-- Devuelve seis conjuntos: alumna, mensualidades, pagos, ventas, productos adquiridos e historial.
CREATE PROCEDURE usp_estado_cuenta(IN p_IdAlumna VARCHAR(50))
BEGIN
    DECLARE v_nombre VARCHAR(120);
    SELECT NOMBRE INTO v_nombre FROM ALUMNA WHERE IDALUMNA = p_IdAlumna;

    SELECT a.*, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO,
           fn_traza('ALUMNA', a.IDALUMNA, 'R') AS MATRICULADOPOR,
           fn_traza('ALUMNA', a.IDALUMNA, 'M') AS MODIFICADOPOR
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
    WHERE a.IDALUMNA = p_IdAlumna;

    SELECT m.IDMENSUALIDAD, m.FECHAINICIO, m.FECHAFIN, m.MONTOREGULAR, m.MONTO,
           GREATEST(IFNULL(m.MONTOREGULAR, m.MONTO) - m.MONTO, 0) AS DESCUENTO,
           IFNULL(pg.PAGADO, 0) AS PAGADO,
           IF(m.ESTADO = 'Inactivo', 0, GREATEST(m.MONTO - IFNULL(pg.PAGADO, 0), 0)) AS SALDO,
           m.ESTADO, pr.NOMBRE AS PROMOCION,
           IF(m.ESTADO IN ('Deuda', 'Parcial') AND STR_TO_DATE(m.FECHAFIN, '%d%m%Y') < CURDATE(), 1, 0) AS VENCIDA,
           fn_traza('MENSUALIDAD', m.IDMENSUALIDAD, 'R') AS REGISTRADOPOR,
           fn_traza('MENSUALIDAD', m.IDMENSUALIDAD, 'M') AS MODIFICADOPOR
    FROM MENSUALIDAD m
    LEFT JOIN PROMOCION pr ON pr.IDPROMOCION = m.IDPROMOCION
    LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
           ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
    WHERE m.IDALUMNA = p_IdAlumna
    ORDER BY STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') DESC;

    SELECT p.IDPAGO, p.FECHA, p.MONTO, p.MEDIO, p.IDMENSUALIDAD,
           CONCAT(fn_fecha_vista(m.FECHAINICIO), ' - ', fn_fecha_vista(m.FECHAFIN)) AS PERIODO,
           IF(p.MONTO < m.MONTO, 1, 0) AS PARCIAL,
           fn_traza('PAGO', p.IDPAGO, 'R') AS REGISTRADOPOR,
           fn_traza('PAGO', p.IDPAGO, 'M') AS MODIFICADOPOR
    FROM PAGO p
    LEFT JOIN MENSUALIDAD m ON m.IDMENSUALIDAD = p.IDMENSUALIDAD
    WHERE p.IDALUMNA = p_IdAlumna
    ORDER BY STR_TO_DATE(p.FECHA, '%d%m%Y') DESC, p.IDPAGO DESC;

    SELECT v.IDVENTA, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.FECHA, v.TIPO, v.PRODUCTO, v.PRECIO,
           IFNULL(v.ACUENTA, v.PRECIO) AS PAGADO,
           IF(v.ESTADO_RECIBO = 'Emitido', GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0), 0) AS SALDO,
           v.MEDIO, v.ESTADO_RECIBO,
           IF(v.TIPO = 'Servicio' AND v.PRODUCTO LIKE 'Clases individuales%', 1, 0) AS CLASE,
           CONCAT(IFNULL(v.USUARIO_EMISION, 'sin usuario'), ' – ', fn_fecha_vista(v.FECHA_EMISION), ' ', LEFT(IFNULL(v.HORA_EMISION, ''), 5)) AS REGISTRADOPOR,
           IF(v.USUARIO_MODIFICACION IS NULL, NULL,
              CONCAT(v.USUARIO_MODIFICACION, ' – ', fn_fecha_vista(v.FECHA_MODIFICACION), ' ', LEFT(IFNULL(v.HORA_MODIFICACION, ''), 5))) AS MODIFICADOPOR
    FROM VENTA v
    WHERE v.IDALUMNA = p_IdAlumna OR (v.IDALUMNA IS NULL AND v.NOMBRE = v_nombre)
    ORDER BY STR_TO_DATE(v.FECHA, '%d%m%Y') DESC, v.IDVENTA DESC;

    SELECT d.PRODUCTO, d.TALLA, d.PRECIO, v.FECHA, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.TIPO
    FROM VENTA_DETALLE d
    INNER JOIN VENTA v ON v.IDVENTA = d.IDVENTA
    WHERE (v.IDALUMNA = p_IdAlumna OR (v.IDALUMNA IS NULL AND v.NOMBRE = v_nombre))
      AND v.ESTADO_RECIBO = 'Emitido'
    ORDER BY STR_TO_DATE(v.FECHA, '%d%m%Y') DESC, d.ORDEN;

    SELECT au.IDAUDITORIA, au.FECHA, au.HORA, au.IDUSUARIO, au.TABLA, au.IDREGISTRO, au.ACCION, au.DETALLE
    FROM AUDITORIA au
    WHERE au.IDALUMNA = p_IdAlumna
       OR (au.TABLA = 'ALUMNA' AND au.IDREGISTRO = p_IdAlumna)
       OR (au.TABLA = 'MENSUALIDAD' AND au.IDREGISTRO IN (SELECT IDMENSUALIDAD FROM MENSUALIDAD WHERE IDALUMNA = p_IdAlumna))
       OR (au.TABLA = 'PAGO' AND au.IDREGISTRO IN (SELECT IDPAGO FROM PAGO WHERE IDALUMNA = p_IdAlumna))
       OR (au.TABLA = 'VENTA' AND au.IDREGISTRO IN (
             SELECT IDVENTA FROM VENTA WHERE IDALUMNA = p_IdAlumna OR (IDALUMNA IS NULL AND NOMBRE = v_nombre)))
    ORDER BY au.IDAUDITORIA DESC
    LIMIT 300;

    SELECT ab.IDABONO, ab.FECHA, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.PRODUCTO, v.PRECIO,
           ab.MONTO, ab.MEDIO, ab.ORIGEN,
           GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0) AS SALDO,
           CONCAT(IFNULL(ab.IDUSUARIO, 'sin usuario'), ' – ', fn_fecha_vista(ab.FECHAREGISTRO), ' ', LEFT(IFNULL(ab.HORAREGISTRO, ''), 5)) AS REGISTRADOPOR
    FROM VENTA_ABONO ab
    INNER JOIN VENTA v ON v.IDVENTA = ab.IDVENTA
    WHERE (v.IDALUMNA = p_IdAlumna OR (v.IDALUMNA IS NULL AND v.NOMBRE = v_nombre))
      AND v.ESTADO_RECIBO = 'Emitido'
    ORDER BY STR_TO_DATE(ab.FECHA, '%d%m%Y') DESC, ab.IDABONO DESC;
END$$

-- Tres conjuntos: mensualidades con saldo, periodos que terminan pronto y ventas con saldo.
CREATE PROCEDURE usp_deudas(IN p_Dias INT)
BEGIN
    DECLARE v_dias INT;
    SET v_dias = IFNULL(p_Dias, 7);

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
    ORDER BY STR_TO_DATE(m.FECHAFIN, '%d%m%Y'), a.NOMBRE;

    SELECT a.IDALUMNA, a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO, a.TELAPODERADO,
           a.INICIOMENSUALIDAD AS FECHAINICIO, a.FINMENSUALIDAD AS FECHAFIN,
           DATEDIFF(STR_TO_DATE(a.FINMENSUALIDAD, '%d%m%Y'), CURDATE()) AS DIAS
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    WHERE a.ESTADO = 'Activa'
      AND STR_TO_DATE(NULLIF(a.FINMENSUALIDAD, ''), '%d%m%Y') BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL v_dias DAY)
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
    ORDER BY STR_TO_DATE(v.FECHA, '%d%m%Y'), v.NOMBRE;
END$$

CREATE PROCEDURE usp_reporte(IN p_Tipo VARCHAR(30), IN p_Desde CHAR(8), IN p_Hasta CHAR(8), IN p_IdCiclo VARCHAR(50))
BEGIN
    DECLARE v_desde DATE;
    DECLARE v_hasta DATE;
    DECLARE v_ciclo VARCHAR(50);
    SET v_desde = STR_TO_DATE(NULLIF(p_Desde, ''), '%d%m%Y');
    SET v_hasta = STR_TO_DATE(NULLIF(p_Hasta, ''), '%d%m%Y');
    SET v_ciclo = NULLIF(p_IdCiclo, '');

    IF p_Tipo = 'matriculas' THEN
        SELECT a.FECHAINSCRIPCION AS FECHA, a.NOMBRE AS ALUMNA, a.DNI, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO, a.ESTADO,
               (SELECT m.MONTO FROM MENSUALIDAD m WHERE m.IDALUMNA = a.IDALUMNA
                 ORDER BY STR_TO_DATE(m.FECHAINICIO, '%d%m%Y'), m.IDMENSUALIDAD LIMIT 1) AS MONTO,
               fn_traza('ALUMNA', a.IDALUMNA, 'R') AS REGISTRADOPOR
        FROM ALUMNA a
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
        WHERE STR_TO_DATE(NULLIF(a.FECHAINSCRIPCION, ''), '%d%m%Y') IS NOT NULL
          AND (v_desde IS NULL OR STR_TO_DATE(a.FECHAINSCRIPCION, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(a.FECHAINSCRIPCION, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        ORDER BY STR_TO_DATE(a.FECHAINSCRIPCION, '%d%m%Y'), a.NOMBRE;

    ELSEIF p_Tipo = 'mensualidades' THEN
        SELECT a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO, m.FECHAINICIO, m.FECHAFIN, m.MONTOREGULAR, m.MONTO,
               GREATEST(IFNULL(m.MONTOREGULAR, m.MONTO) - m.MONTO, 0) AS DESCUENTO,
               IFNULL(pg.PAGADO, 0) AS PAGADO,
               IF(m.ESTADO = 'Inactivo', 0, GREATEST(m.MONTO - IFNULL(pg.PAGADO, 0), 0)) AS SALDO,
               m.ESTADO, pr.NOMBRE AS PROMOCION
        FROM MENSUALIDAD m
        INNER JOIN ALUMNA a ON a.IDALUMNA = m.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN PROMOCION pr ON pr.IDPROMOCION = m.IDPROMOCION
        LEFT JOIN (SELECT IDMENSUALIDAD, SUM(MONTO) AS PAGADO FROM PAGO GROUP BY IDMENSUALIDAD) pg
               ON pg.IDMENSUALIDAD = m.IDMENSUALIDAD
        WHERE (v_desde IS NULL OR STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(m.FECHAINICIO, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        ORDER BY STR_TO_DATE(m.FECHAINICIO, '%d%m%Y'), a.NOMBRE;

    ELSEIF p_Tipo = 'ventas' THEN
        SELECT IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.FECHA, v.NOMBRE, c.NOMBRE AS CICLO, v.TIPO, v.PRODUCTO,
               v.PRECIO, IFNULL(v.ACUENTA, v.PRECIO) AS PAGADO,
               IF(v.ESTADO_RECIBO = 'Emitido', GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0), 0) AS SALDO,
               v.MEDIO, v.ESTADO_RECIBO AS ESTADO, v.USUARIO_EMISION AS REGISTRADOPOR
        FROM VENTA v
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        WHERE v.ESTADO_RECIBO <> 'Eliminado'
          AND (v_desde IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        ORDER BY STR_TO_DATE(v.FECHA, '%d%m%Y'), v.IDVENTA;

    ELSEIF p_Tipo = 'productos' THEN
        SELECT d.PRODUCTO, IFNULL(d.TALLA, '') AS TALLA, COUNT(*) AS CANTIDAD, SUM(d.PRECIO) AS TOTAL
        FROM VENTA_DETALLE d
        INNER JOIN VENTA v ON v.IDVENTA = d.IDVENTA
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        WHERE v.ESTADO_RECIBO = 'Emitido' AND v.TIPO = 'Producto físico'
          AND (v_desde IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        GROUP BY d.PRODUCTO, IFNULL(d.TALLA, '')
        ORDER BY CANTIDAD DESC, d.PRODUCTO;

    ELSEIF p_Tipo = 'clases' THEN
        SELECT v.FECHA, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.NOMBRE, c.NOMBRE AS CICLO, v.PRECIO,
               IFNULL(v.ACUENTA, v.PRECIO) AS PAGADO,
               GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0) AS SALDO,
               v.MEDIO, v.USUARIO_EMISION AS REGISTRADOPOR
        FROM VENTA v
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        WHERE v.ESTADO_RECIBO = 'Emitido' AND v.TIPO = 'Servicio' AND v.PRODUCTO LIKE 'Clases individuales%'
          AND (v_desde IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(v.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        ORDER BY STR_TO_DATE(v.FECHA, '%d%m%Y'), v.IDVENTA;

    ELSEIF p_Tipo = 'pagos' THEN
        SELECT p.FECHA, p.IDPAGO, a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO,
               CONCAT(fn_fecha_vista(m.FECHAINICIO), ' - ', fn_fecha_vista(m.FECHAFIN)) AS PERIODO,
               p.MONTO, p.MEDIO, fn_traza('PAGO', p.IDPAGO, 'R') AS REGISTRADOPOR
        FROM PAGO p
        INNER JOIN ALUMNA a ON a.IDALUMNA = p.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN MENSUALIDAD m ON m.IDMENSUALIDAD = p.IDMENSUALIDAD
        WHERE (v_desde IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(p.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        ORDER BY STR_TO_DATE(p.FECHA, '%d%m%Y'), p.IDPAGO;

    ELSEIF p_Tipo = 'saldos' THEN
        SELECT * FROM (
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
        ) s
        ORDER BY s.ALUMNA, STR_TO_DATE(s.FECHA, '%d%m%Y');

    ELSEIF p_Tipo = 'activas' THEN
        SELECT a.NOMBRE AS ALUMNA, a.DNI, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO, a.TELEFONO, a.APODERADO,
               a.TELAPODERADO, a.FECHAINSCRIPCION, a.FINMENSUALIDAD
        FROM ALUMNA a
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
        WHERE a.ESTADO = 'Activa' AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        ORDER BY c.NOMBRE, a.NOMBRE;

    ELSEIF p_Tipo = 'retiradas' THEN
        SELECT a.NOMBRE AS ALUMNA, a.DNI, c.NOMBRE AS CICLO, a.ESTADO, a.FECHARETIRO, a.MOTIVORETIRO, a.TELAPODERADO
        FROM ALUMNA a
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        WHERE a.ESTADO IN ('Retirada', 'Inactiva')
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
          AND (v_desde IS NULL OR a.FECHARETIRO IS NULL OR STR_TO_DATE(a.FECHARETIRO, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR a.FECHARETIRO IS NULL OR STR_TO_DATE(a.FECHARETIRO, '%d%m%Y') <= v_hasta)
        ORDER BY STR_TO_DATE(a.FECHARETIRO, '%d%m%Y') DESC, a.NOMBRE;

    ELSEIF p_Tipo = 'cumpleanos' THEN
        SELECT a.FECHANACIMIENTO, a.NOMBRE AS ALUMNA,
               TIMESTAMPDIFF(YEAR, STR_TO_DATE(a.FECHANACIMIENTO, '%d%m%Y'), IFNULL(v_hasta, CURDATE())) AS EDAD,
               c.NOMBRE AS CICLO, t.NOMBRE AS TURNO, a.APODERADO, a.TELAPODERADO
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
               OR DATEDIFF(v_hasta, v_desde) >= 365)
        ORDER BY SUBSTRING(a.FECHANACIMIENTO, 3, 2), SUBSTRING(a.FECHANACIMIENTO, 1, 2), a.NOMBRE;

    ELSEIF p_Tipo = 'ingresos' THEN
        SELECT IFNULL(x.CICLO, 'Sin categoría') AS CICLO,
               SUM(x.PAGOS) AS PAGOS, SUM(x.VENTAS) AS VENTAS, SUM(x.PAGOS + x.VENTAS) AS TOTAL
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
        GROUP BY IFNULL(x.CICLO, 'Sin categoría')
        ORDER BY TOTAL DESC;
    ELSEIF p_Tipo = 'abonos' THEN
        SELECT ab.FECHA, ab.IDABONO, IFNULL(v.COMPROBANTE, v.IDVENTA) AS NUMERO, v.NOMBRE, v.IDALUMNA,
               c.NOMBRE AS CICLO, v.PRODUCTO, ab.ORIGEN, ab.MONTO, ab.MEDIO,
               GREATEST(v.PRECIO - IFNULL(v.ACUENTA, v.PRECIO), 0) AS SALDO,
               CONCAT(IFNULL(ab.IDUSUARIO, 'sin usuario'), ' – ', fn_fecha_vista(ab.FECHAREGISTRO), ' ', LEFT(IFNULL(ab.HORAREGISTRO, ''), 5)) AS REGISTRADOPOR
        FROM VENTA_ABONO ab
        INNER JOIN VENTA v ON v.IDVENTA = ab.IDVENTA
        LEFT JOIN ALUMNA a ON a.IDALUMNA = v.IDALUMNA
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        WHERE v.ESTADO_RECIBO = 'Emitido'
          AND (v_desde IS NULL OR STR_TO_DATE(ab.FECHA, '%d%m%Y') >= v_desde)
          AND (v_hasta IS NULL OR STR_TO_DATE(ab.FECHA, '%d%m%Y') <= v_hasta)
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        ORDER BY STR_TO_DATE(ab.FECHA, '%d%m%Y'), ab.IDABONO;
    ELSEIF p_Tipo = 'asistencias' THEN
        SELECT a.IDALUMNA, a.NOMBRE AS ALUMNA, c.NOMBRE AS CICLO, t.NOMBRE AS TURNO,
               SUM(s.ESTADO = 'Presente') AS PRESENTES,
               SUM(s.ESTADO <> 'Presente') AS FALTAS,
               COUNT(s.IDASISTENCIA) AS REGISTROS,
               ROUND(100 * SUM(s.ESTADO = 'Presente') / NULLIF(COUNT(s.IDASISTENCIA), 0), 0) AS PORCENTAJE
        FROM ALUMNA a
        LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
        LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
        LEFT JOIN ASISTENCIA s ON s.IDALUMNA = a.IDALUMNA
             AND (v_desde IS NULL OR STR_TO_DATE(s.FECHA, '%d%m%Y') >= v_desde)
             AND (v_hasta IS NULL OR STR_TO_DATE(s.FECHA, '%d%m%Y') <= v_hasta)
        WHERE a.ESTADO = 'Activa'
          AND (v_ciclo IS NULL OR a.IDCICLO = v_ciclo)
        GROUP BY a.IDALUMNA, a.NOMBRE, c.NOMBRE, t.NOMBRE
        ORDER BY t.NOMBRE, a.NOMBRE;
    END IF;
END$$

DELIMITER ;
