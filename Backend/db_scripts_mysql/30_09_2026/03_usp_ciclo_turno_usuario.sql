USE `VoleyDB`;

DROP PROCEDURE IF EXISTS usp_login_obtener;
DROP PROCEDURE IF EXISTS usp_ciclo_listar;
DROP PROCEDURE IF EXISTS usp_ciclo_obtener;
DROP PROCEDURE IF EXISTS usp_ciclo_insertar;
DROP PROCEDURE IF EXISTS usp_ciclo_actualizar;
DROP PROCEDURE IF EXISTS usp_ciclo_eliminar;
DROP PROCEDURE IF EXISTS usp_turno_listar;
DROP PROCEDURE IF EXISTS usp_turno_obtener;
DROP PROCEDURE IF EXISTS usp_turno_insertar;
DROP PROCEDURE IF EXISTS usp_turno_actualizar;
DROP PROCEDURE IF EXISTS usp_turno_eliminar;
DROP PROCEDURE IF EXISTS usp_usuario_listar;
DROP PROCEDURE IF EXISTS usp_usuario_obtener;
DROP PROCEDURE IF EXISTS usp_usuario_insertar;
DROP PROCEDURE IF EXISTS usp_usuario_actualizar;
DROP PROCEDURE IF EXISTS usp_usuario_eliminar;

DELIMITER $$

CREATE PROCEDURE usp_login_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT u.IDUSUARIO, u.CONTRA, u.ESTADO, u.IDTIPOUSUARIO,
           u.NOMBRE, u.APELLIDO, u.DNI, u.EMAIL,
           t.DESCRIPCION AS TIPOUSUARIO_DESCRIPCION
    FROM USUARIO u
    INNER JOIN TIPOUSUARIO t ON t.IDTIPOUSUARIO = u.IDTIPOUSUARIO
    WHERE u.IDUSUARIO = p_Id;
END$$

CREATE PROCEDURE usp_ciclo_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4),
    IN p_Pagina INT, IN p_Tamanio INT, OUT p_Total INT
)
BEGIN
    DECLARE v_off INT DEFAULT 0;
    IF p_Pagina IS NULL OR p_Pagina < 1 THEN SET p_Pagina = 1; END IF;
    IF p_Tamanio IS NULL OR p_Tamanio < 1 THEN SET p_Tamanio = 10; END IF;
    SET v_off = (p_Pagina - 1) * p_Tamanio;
    SELECT COUNT(*) INTO p_Total FROM CICLO c
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR c.NOMBRE LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR (p_Estado = 'Activo' AND c.ACTIVO = 1) OR (p_Estado = 'Inactivo' AND c.ACTIVO = 0));
    SELECT c.IDCICLO, c.NOMBRE, c.SLUG,
           IF(c.ACTIVO = 1, 'Activo', 'Inactivo') AS ACTIVO
    FROM CICLO c
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR c.NOMBRE LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR (p_Estado = 'Activo' AND c.ACTIVO = 1) OR (p_Estado = 'Inactivo' AND c.ACTIVO = 0))
    ORDER BY
        CASE WHEN p_OrdenarPor = 'NOMBRE' AND p_Direccion = 'DESC' THEN c.NOMBRE END DESC,
        c.NOMBRE
    LIMIT v_off, p_Tamanio;
END$$

CREATE PROCEDURE usp_ciclo_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT IDCICLO, NOMBRE, SLUG, IF(ACTIVO = 1, 'Activo', 'Inactivo') AS ACTIVO
    FROM CICLO WHERE IDCICLO = p_Id;
END$$

CREATE PROCEDURE usp_ciclo_insertar(
    IN p_Nombre VARCHAR(120), IN p_Activo VARCHAR(20),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    IF p_Nombre IS NULL OR TRIM(p_Nombre) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el nombre del ciclo.'; LEAVE proc;
    END IF;
    SELECT CONCAT('CIC', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDCICLO, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM CICLO;
    INSERT INTO CICLO (IDCICLO, NOMBRE, SLUG, ACTIVO, FECHACREACION)
    VALUES (v_id, TRIM(p_Nombre), LOWER(REPLACE(TRIM(p_Nombre), ' ', '-')),
            IF(p_Activo = 'Inactivo', 0, 1), DATE_FORMAT(NOW(), '%d%m%Y'));
    SET p_Resultado = 1; SET p_Mensaje = 'Ciclo registrado.';
END$$

CREATE PROCEDURE usp_ciclo_actualizar(
    IN p_Id VARCHAR(50), IN p_Nombre VARCHAR(120), IN p_Activo VARCHAR(20),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    IF NOT EXISTS (SELECT 1 FROM CICLO WHERE IDCICLO = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'El ciclo no existe.'; LEAVE proc;
    END IF;
    IF p_Nombre IS NULL OR TRIM(p_Nombre) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el nombre del ciclo.'; LEAVE proc;
    END IF;
    UPDATE CICLO
       SET NOMBRE = TRIM(p_Nombre),
           SLUG = LOWER(REPLACE(TRIM(p_Nombre), ' ', '-')),
           ACTIVO = IF(p_Activo = 'Inactivo', 0, 1)
     WHERE IDCICLO = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Ciclo actualizado.';
END$$

CREATE PROCEDURE usp_ciclo_eliminar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
proc: BEGIN
    IF EXISTS (SELECT 1 FROM ALUMNA WHERE IDCICLO = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'No se puede eliminar: hay alumnas en este ciclo.'; LEAVE proc;
    END IF;
    DELETE FROM CICLO WHERE IDCICLO = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Ciclo eliminado.';
END$$

CREATE PROCEDURE usp_turno_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20),
    IN p_OrdenarPor VARCHAR(50), IN p_Direccion VARCHAR(4),
    IN p_Pagina INT, IN p_Tamanio INT, OUT p_Total INT
)
BEGIN
    DECLARE v_off INT DEFAULT 0;
    IF p_Pagina IS NULL OR p_Pagina < 1 THEN SET p_Pagina = 1; END IF;
    IF p_Tamanio IS NULL OR p_Tamanio < 1 THEN SET p_Tamanio = 10; END IF;
    SET v_off = (p_Pagina - 1) * p_Tamanio;
    SELECT COUNT(*) INTO p_Total FROM TURNO t
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR t.NOMBRE LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR (p_Estado = 'Activo' AND t.ACTIVO = 1) OR (p_Estado = 'Inactivo' AND t.ACTIVO = 0));
    SELECT t.IDTURNO, t.NOMBRE, t.HORAINICIO, t.HORAFIN, t.DIASACTIVOS,
           CONCAT(t.HORAINICIO, ' - ', t.HORAFIN) AS HORARIO,
           IF(t.ACTIVO = 1, 'Activo', 'Inactivo') AS ACTIVO
    FROM TURNO t
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR t.NOMBRE LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR (p_Estado = 'Activo' AND t.ACTIVO = 1) OR (p_Estado = 'Inactivo' AND t.ACTIVO = 0))
    ORDER BY t.HORAINICIO, t.NOMBRE
    LIMIT v_off, p_Tamanio;
END$$

CREATE PROCEDURE usp_turno_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT IDTURNO, NOMBRE, HORAINICIO, HORAFIN, DIASACTIVOS,
           IF(ACTIVO = 1, 'Activo', 'Inactivo') AS ACTIVO
    FROM TURNO WHERE IDTURNO = p_Id;
END$$

CREATE PROCEDURE usp_turno_insertar(
    IN p_Nombre VARCHAR(120), IN p_HoraInicio CHAR(5), IN p_HoraFin CHAR(5),
    IN p_Dias VARCHAR(120), IN p_Activo VARCHAR(20),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    IF p_Nombre IS NULL OR TRIM(p_Nombre) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el nombre del turno.'; LEAVE proc;
    END IF;
    IF p_HoraInicio IS NULL OR p_HoraFin IS NULL THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa la hora de inicio y fin.'; LEAVE proc;
    END IF;
    SELECT CONCAT('TUR', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDTURNO, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM TURNO;
    INSERT INTO TURNO (IDTURNO, NOMBRE, HORAINICIO, HORAFIN, DIASACTIVOS, ACTIVO, FECHACREACION)
    VALUES (v_id, TRIM(p_Nombre), LEFT(p_HoraInicio, 5), LEFT(p_HoraFin, 5),
            NULLIF(TRIM(IFNULL(p_Dias, '')), ''), IF(p_Activo = 'Inactivo', 0, 1), DATE_FORMAT(NOW(), '%d%m%Y'));
    SET p_Resultado = 1; SET p_Mensaje = 'Turno registrado.';
END$$

CREATE PROCEDURE usp_turno_actualizar(
    IN p_Id VARCHAR(50), IN p_Nombre VARCHAR(120), IN p_HoraInicio CHAR(5), IN p_HoraFin CHAR(5),
    IN p_Dias VARCHAR(120), IN p_Activo VARCHAR(20),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    IF NOT EXISTS (SELECT 1 FROM TURNO WHERE IDTURNO = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'El turno no existe.'; LEAVE proc;
    END IF;
    UPDATE TURNO
       SET NOMBRE = TRIM(p_Nombre),
           HORAINICIO = LEFT(p_HoraInicio, 5),
           HORAFIN = LEFT(p_HoraFin, 5),
           DIASACTIVOS = NULLIF(TRIM(IFNULL(p_Dias, '')), ''),
           ACTIVO = IF(p_Activo = 'Inactivo', 0, 1)
     WHERE IDTURNO = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Turno actualizado.';
END$$

CREATE PROCEDURE usp_turno_eliminar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
proc: BEGIN
    IF EXISTS (SELECT 1 FROM ALUMNA WHERE IDTURNO = p_Id) OR EXISTS (SELECT 1 FROM VENTA WHERE IDTURNO = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'No se puede eliminar: el turno está en uso.'; LEAVE proc;
    END IF;
    DELETE FROM TURNO WHERE IDTURNO = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Turno eliminado.';
END$$

CREATE PROCEDURE usp_usuario_listar(
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
    FROM USUARIO u
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR u.IDUSUARIO LIKE CONCAT('%', p_Buscar, '%')
           OR u.NOMBRE LIKE CONCAT('%', p_Buscar, '%') OR u.APELLIDO LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR u.ESTADO = p_Estado);
    SELECT u.IDUSUARIO, u.NOMBRE, u.APELLIDO, u.DNI, u.EMAIL, u.ESTADO,
           u.IDTIPOUSUARIO, t.DESCRIPCION AS TIPOUSUARIO_DESCRIPCION
    FROM USUARIO u
    INNER JOIN TIPOUSUARIO t ON t.IDTIPOUSUARIO = u.IDTIPOUSUARIO
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR u.IDUSUARIO LIKE CONCAT('%', p_Buscar, '%')
           OR u.NOMBRE LIKE CONCAT('%', p_Buscar, '%') OR u.APELLIDO LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR u.ESTADO = p_Estado)
    ORDER BY u.NOMBRE, u.APELLIDO
    LIMIT v_off, p_Tamanio;
END$$

CREATE PROCEDURE usp_usuario_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT u.IDUSUARIO, u.NOMBRE, u.APELLIDO, u.DNI, u.EMAIL, u.ESTADO,
           u.IDTIPOUSUARIO, t.DESCRIPCION AS TIPOUSUARIO_DESCRIPCION
    FROM USUARIO u
    INNER JOIN TIPOUSUARIO t ON t.IDTIPOUSUARIO = u.IDTIPOUSUARIO
    WHERE u.IDUSUARIO = p_Id;
END$$

CREATE PROCEDURE usp_usuario_insertar(
    IN p_Id VARCHAR(50), IN p_Contra VARCHAR(255), IN p_Nombre VARCHAR(100), IN p_Apellido VARCHAR(100),
    IN p_Dni VARCHAR(20), IN p_Email VARCHAR(150), IN p_IdTipo VARCHAR(50), IN p_Estado VARCHAR(50),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    IF p_Id IS NULL OR TRIM(p_Id) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el usuario.'; LEAVE proc;
    END IF;
    IF EXISTS (SELECT 1 FROM USUARIO WHERE IDUSUARIO = TRIM(p_Id)) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ese usuario ya existe.'; LEAVE proc;
    END IF;
    IF p_IdTipo IS NULL OR NOT EXISTS (SELECT 1 FROM TIPOUSUARIO WHERE IDTIPOUSUARIO = p_IdTipo) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Selecciona el tipo de usuario.'; LEAVE proc;
    END IF;
    INSERT INTO USUARIO (IDUSUARIO, CONTRA, NOMBRE, APELLIDO, DNI, EMAIL, ESTADO, IDTIPOUSUARIO)
    VALUES (TRIM(p_Id), IFNULL(NULLIF(TRIM(IFNULL(p_Contra, '')), ''), TRIM(p_Id)),
            TRIM(IFNULL(p_Nombre, '')), TRIM(IFNULL(p_Apellido, '-')),
            IFNULL(NULLIF(TRIM(IFNULL(p_Dni, '')), ''), '00000000'),
            NULLIF(TRIM(IFNULL(p_Email, '')), ''),
            IF(p_Estado = 'Retirado', 'Retirado', 'Activo'), p_IdTipo);
    SET p_Resultado = 1; SET p_Mensaje = 'Usuario registrado.';
END$$

CREATE PROCEDURE usp_usuario_actualizar(
    IN p_Id VARCHAR(50), IN p_Contra VARCHAR(255), IN p_Nombre VARCHAR(100), IN p_Apellido VARCHAR(100),
    IN p_Dni VARCHAR(20), IN p_Email VARCHAR(150), IN p_IdTipo VARCHAR(50), IN p_Estado VARCHAR(50),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    IF NOT EXISTS (SELECT 1 FROM USUARIO WHERE IDUSUARIO = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'El usuario no existe.'; LEAVE proc;
    END IF;
    UPDATE USUARIO
       SET NOMBRE = TRIM(IFNULL(p_Nombre, NOMBRE)),
           APELLIDO = TRIM(IFNULL(p_Apellido, APELLIDO)),
           DNI = IFNULL(NULLIF(TRIM(IFNULL(p_Dni, '')), ''), DNI),
           EMAIL = NULLIF(TRIM(IFNULL(p_Email, '')), ''),
           IDTIPOUSUARIO = IFNULL(p_IdTipo, IDTIPOUSUARIO),
           ESTADO = IF(p_Estado = 'Retirado', 'Retirado', 'Activo'),
           CONTRA = IF(p_Contra IS NULL OR TRIM(p_Contra) = '', CONTRA, TRIM(p_Contra))
     WHERE IDUSUARIO = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Usuario actualizado.';
END$$

CREATE PROCEDURE usp_usuario_eliminar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
proc: BEGIN
    IF p_Id IN ('vita', 'admin') THEN
        SET p_Resultado = 0; SET p_Mensaje = 'No se puede eliminar el usuario de acceso principal.'; LEAVE proc;
    END IF;
    DELETE FROM USUARIO_MODULO WHERE IDUSUARIO = p_Id;
    DELETE FROM USUARIO_MODULO_EXCLUIDO WHERE IDUSUARIO = p_Id;
    DELETE FROM USUARIO_SUBMODULO_EXCLUIDO WHERE IDUSUARIO = p_Id;
    DELETE FROM USUARIO_SUBMODULO_INCLUIDO WHERE IDUSUARIO = p_Id;
    DELETE FROM USUARIO WHERE IDUSUARIO = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Usuario eliminado.';
END$$

DELIMITER ;
