USE `VoleyDB`;

-- Administración de accesos: qué módulos y submódulos del menú ve cada rol o usuario.
-- Se puede volver a ejecutar sin perder datos.
--
-- Por rol: GRUPO_MODULO da el módulo; GRUPO_SUBMODULO_EXCLUIDO oculta submódulos.
-- Por usuario (excepciones al rol): USUARIO_MODULO / USUARIO_MODULO_EXCLUIDO para módulos;
-- para submódulos manda la exclusión del usuario, luego su inclusión y luego la exclusión del rol.
-- El administrador (tipo 3) siempre conserva los módulos de MODULOS_PROTEGIDOS_ADMIN (menu_config.py)
-- y el submódulo Accesos, para que nadie quede sin poder administrar.

INSERT IGNORE INTO SUBMODULO (IDSUBMODULO, NOMBRE, DESCRIPCION, ICONO, ORDEN, ACTIVO, IDMODULO) VALUES
('SUB016', 'Accesos por rol', 'Módulos y submódulos que ve cada rol o usuario', 'faUserShield', 8, 1, 'MOD003');

DROP FUNCTION IF EXISTS fn_acceso_modulo;
DROP FUNCTION IF EXISTS fn_acceso_submodulo;
DROP FUNCTION IF EXISTS fn_acceso_protegido;
DROP PROCEDURE IF EXISTS usp_acceso_roles_listar;
DROP PROCEDURE IF EXISTS usp_acceso_usuarios_listar;
DROP PROCEDURE IF EXISTS usp_acceso_modulos;
DROP PROCEDURE IF EXISTS usp_acceso_submodulos;
DROP PROCEDURE IF EXISTS usp_acceso_modulo_guardar;
DROP PROCEDURE IF EXISTS usp_acceso_submodulo_guardar;

DELIMITER $$

-- 1 si el módulo o submódulo (p_Id) no se le puede quitar al tipo de usuario.
CREATE FUNCTION fn_acceso_protegido(p_IdTipo VARCHAR(50), p_Id VARCHAR(50)) RETURNS TINYINT
DETERMINISTIC
BEGIN
    RETURN IFNULL(p_IdTipo, '') = '3' AND p_Id IN ('MOD001', 'MOD002', 'MOD003', 'SUB016');
END$$

-- 1 si el rol (p_IdUsuario NULL) o el usuario tiene el módulo.
CREATE FUNCTION fn_acceso_modulo(p_IdTipo VARCHAR(50), p_IdUsuario VARCHAR(50), p_IdModulo VARCHAR(50))
RETURNS TINYINT
READS SQL DATA
BEGIN
    IF fn_acceso_protegido(p_IdTipo, p_IdModulo) THEN
        RETURN 1;
    END IF;
    IF p_IdUsuario IS NOT NULL AND EXISTS (
        SELECT 1 FROM USUARIO_MODULO_EXCLUIDO WHERE IDUSUARIO = p_IdUsuario AND IDMODULO = p_IdModulo
    ) THEN
        RETURN 0;
    END IF;
    RETURN EXISTS (SELECT 1 FROM GRUPO_MODULO WHERE IDTIPOUSUARIO = p_IdTipo AND IDMODULO = p_IdModulo)
        OR (p_IdUsuario IS NOT NULL AND EXISTS (
            SELECT 1 FROM USUARIO_MODULO WHERE IDUSUARIO = p_IdUsuario AND IDMODULO = p_IdModulo
        ));
END$$

-- 1 si el rol (p_IdUsuario NULL) o el usuario ve el submódulo cuando tiene su módulo.
CREATE FUNCTION fn_acceso_submodulo(p_IdTipo VARCHAR(50), p_IdUsuario VARCHAR(50), p_IdSubmodulo VARCHAR(50))
RETURNS TINYINT
READS SQL DATA
BEGIN
    IF fn_acceso_protegido(p_IdTipo, p_IdSubmodulo) THEN
        RETURN 1;
    END IF;
    IF p_IdUsuario IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM USUARIO_SUBMODULO_EXCLUIDO WHERE IDUSUARIO = p_IdUsuario AND IDSUBMODULO = p_IdSubmodulo) THEN
            RETURN 0;
        END IF;
        IF EXISTS (SELECT 1 FROM USUARIO_SUBMODULO_INCLUIDO WHERE IDUSUARIO = p_IdUsuario AND IDSUBMODULO = p_IdSubmodulo) THEN
            RETURN 1;
        END IF;
    END IF;
    RETURN NOT EXISTS (
        SELECT 1 FROM GRUPO_SUBMODULO_EXCLUIDO WHERE IDTIPOUSUARIO = p_IdTipo AND IDSUBMODULO = p_IdSubmodulo
    );
END$$

CREATE PROCEDURE usp_acceso_roles_listar()
BEGIN
    SELECT t.IDTIPOUSUARIO, t.DESCRIPCION,
           (SELECT COUNT(*) FROM USUARIO u WHERE u.IDTIPOUSUARIO = t.IDTIPOUSUARIO AND u.ESTADO = 'Activo') AS USUARIOS
    FROM TIPOUSUARIO t
    ORDER BY t.IDTIPOUSUARIO;
END$$

CREATE PROCEDURE usp_acceso_usuarios_listar()
BEGIN
    SELECT u.IDUSUARIO, TRIM(CONCAT(u.NOMBRE, ' ', u.APELLIDO)) AS NOMBRE, u.EMAIL,
           u.IDTIPOUSUARIO, t.DESCRIPCION AS ROL
    FROM USUARIO u
    INNER JOIN TIPOUSUARIO t ON t.IDTIPOUSUARIO = u.IDTIPOUSUARIO
    WHERE u.ESTADO = 'Activo'
    ORDER BY NOMBRE;
END$$

-- Todos los módulos activos con su estado para el rol o el usuario (p_IdUsuario manda si viene).
CREATE PROCEDURE usp_acceso_modulos(IN p_IdTipo VARCHAR(50), IN p_IdUsuario VARCHAR(50))
BEGIN
    DECLARE v_usuario VARCHAR(50);
    DECLARE v_tipo VARCHAR(50);
    SET v_usuario = NULLIF(TRIM(IFNULL(p_IdUsuario, '')), '');
    SET v_tipo = p_IdTipo;
    IF v_usuario IS NOT NULL THEN
        SET v_tipo = (SELECT IDTIPOUSUARIO FROM USUARIO WHERE IDUSUARIO = v_usuario);
    END IF;

    SELECT m.IDMODULO, m.NOMBRE, m.DESCRIPCION, m.ICONO,
           fn_acceso_modulo(v_tipo, v_usuario, m.IDMODULO) AS ASIGNADO,
           fn_acceso_protegido(v_tipo, m.IDMODULO) AS PROTEGIDO,
           (SELECT COUNT(*) FROM SUBMODULO s WHERE s.IDMODULO = m.IDMODULO AND s.ACTIVO = 1) AS SUBMODULOS,
           (SELECT COUNT(*) FROM SUBMODULO s
             WHERE s.IDMODULO = m.IDMODULO AND s.ACTIVO = 1
               AND fn_acceso_submodulo(v_tipo, v_usuario, s.IDSUBMODULO) = 1) AS SUBMODULOS_CON_ACCESO
    FROM MODULO m
    WHERE m.ACTIVO = 1 AND v_tipo IS NOT NULL
    ORDER BY m.ORDEN, m.NOMBRE;
END$$

CREATE PROCEDURE usp_acceso_submodulos(IN p_IdTipo VARCHAR(50), IN p_IdUsuario VARCHAR(50), IN p_IdModulo VARCHAR(50))
BEGIN
    DECLARE v_usuario VARCHAR(50);
    DECLARE v_tipo VARCHAR(50);
    SET v_usuario = NULLIF(TRIM(IFNULL(p_IdUsuario, '')), '');
    SET v_tipo = p_IdTipo;
    IF v_usuario IS NOT NULL THEN
        SET v_tipo = (SELECT IDTIPOUSUARIO FROM USUARIO WHERE IDUSUARIO = v_usuario);
    END IF;

    SELECT s.IDSUBMODULO, s.NOMBRE, s.DESCRIPCION, s.ICONO,
           fn_acceso_submodulo(v_tipo, v_usuario, s.IDSUBMODULO) AS ASIGNADO,
           fn_acceso_protegido(v_tipo, s.IDSUBMODULO) AS PROTEGIDO
    FROM SUBMODULO s
    WHERE s.IDMODULO = p_IdModulo AND s.ACTIVO = 1 AND v_tipo IS NOT NULL
    ORDER BY s.ORDEN, s.NOMBRE;
END$$

CREATE PROCEDURE usp_acceso_modulo_guardar(
    IN p_IdTipo VARCHAR(50), IN p_IdUsuario VARCHAR(50), IN p_IdModulo VARCHAR(50), IN p_Asignar TINYINT,
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_usuario VARCHAR(50);
    DECLARE v_tipo VARCHAR(50);
    DECLARE v_del_rol TINYINT;
    SET p_Resultado = 0;
    SET v_usuario = NULLIF(TRIM(IFNULL(p_IdUsuario, '')), '');
    IF v_usuario IS NULL THEN
        SET v_tipo = (SELECT IDTIPOUSUARIO FROM TIPOUSUARIO WHERE IDTIPOUSUARIO = p_IdTipo);
    ELSE
        SET v_tipo = (SELECT IDTIPOUSUARIO FROM USUARIO WHERE IDUSUARIO = v_usuario AND ESTADO = 'Activo');
    END IF;
    IF v_tipo IS NULL THEN
        SET p_Mensaje = IF(v_usuario IS NULL, 'El rol no existe.', 'El usuario no existe o está inactivo.'); LEAVE proc;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM MODULO WHERE IDMODULO = p_IdModulo AND ACTIVO = 1) THEN
        SET p_Mensaje = 'El módulo no existe o está inactivo.'; LEAVE proc;
    END IF;
    IF NOT p_Asignar AND fn_acceso_protegido(v_tipo, p_IdModulo) THEN
        SET p_Mensaje = 'El administrador siempre tiene Dashboard, Academia y Administración.'; LEAVE proc;
    END IF;

    IF v_usuario IS NULL THEN
        IF p_Asignar THEN
            INSERT IGNORE INTO GRUPO_MODULO (IDGRUPOMODULO, IDTIPOUSUARIO, IDMODULO, IDTIPOPERMISO)
            SELECT CONCAT('GRM_', REPLACE(UUID(), '-', '')), v_tipo, p_IdModulo, IDTIPOPERMISO FROM TIPO_PERMISO;
        ELSE
            DELETE FROM GRUPO_MODULO WHERE IDTIPOUSUARIO = v_tipo AND IDMODULO = p_IdModulo;
            DELETE g FROM GRUPO_SUBMODULO_EXCLUIDO g
            INNER JOIN SUBMODULO s ON s.IDSUBMODULO = g.IDSUBMODULO
            WHERE g.IDTIPOUSUARIO = v_tipo AND s.IDMODULO = p_IdModulo;
        END IF;
    ELSE
        SET v_del_rol = EXISTS (SELECT 1 FROM GRUPO_MODULO WHERE IDTIPOUSUARIO = v_tipo AND IDMODULO = p_IdModulo);
        IF p_Asignar THEN
            DELETE FROM USUARIO_MODULO_EXCLUIDO WHERE IDUSUARIO = v_usuario AND IDMODULO = p_IdModulo;
            IF NOT v_del_rol THEN
                INSERT IGNORE INTO USUARIO_MODULO (IDUSUARIOMODULO, IDUSUARIO, IDMODULO, IDTIPOPERMISO)
                SELECT CONCAT('UM_', REPLACE(UUID(), '-', '')), v_usuario, p_IdModulo, IDTIPOPERMISO FROM TIPO_PERMISO;
            END IF;
        ELSE
            DELETE FROM USUARIO_MODULO WHERE IDUSUARIO = v_usuario AND IDMODULO = p_IdModulo;
            IF v_del_rol THEN
                INSERT IGNORE INTO USUARIO_MODULO_EXCLUIDO (IDUSUARIOEXCLUIDO, IDUSUARIO, IDMODULO, FECHAREGISTRO)
                VALUES (CONCAT('UME_', REPLACE(UUID(), '-', '')), v_usuario, p_IdModulo, DATE_FORMAT(CURDATE(), '%d%m%Y'));
            END IF;
            DELETE x FROM USUARIO_SUBMODULO_EXCLUIDO x
            INNER JOIN SUBMODULO s ON s.IDSUBMODULO = x.IDSUBMODULO
            WHERE x.IDUSUARIO = v_usuario AND s.IDMODULO = p_IdModulo;
            DELETE x FROM USUARIO_SUBMODULO_INCLUIDO x
            INNER JOIN SUBMODULO s ON s.IDSUBMODULO = x.IDSUBMODULO
            WHERE x.IDUSUARIO = v_usuario AND s.IDMODULO = p_IdModulo;
        END IF;
    END IF;

    SET p_Resultado = 1;
    SET p_Mensaje = IF(p_Asignar, 'Módulo asignado.', 'Módulo quitado.');
END$$

CREATE PROCEDURE usp_acceso_submodulo_guardar(
    IN p_IdTipo VARCHAR(50), IN p_IdUsuario VARCHAR(50), IN p_IdSubmodulo VARCHAR(50), IN p_Asignar TINYINT,
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    DECLARE v_usuario VARCHAR(50);
    DECLARE v_tipo VARCHAR(50);
    DECLARE v_rol_excluye TINYINT;
    DECLARE v_fecha CHAR(8);
    SET p_Resultado = 0;
    SET v_fecha = DATE_FORMAT(CURDATE(), '%d%m%Y');
    SET v_usuario = NULLIF(TRIM(IFNULL(p_IdUsuario, '')), '');
    IF v_usuario IS NULL THEN
        SET v_tipo = (SELECT IDTIPOUSUARIO FROM TIPOUSUARIO WHERE IDTIPOUSUARIO = p_IdTipo);
    ELSE
        SET v_tipo = (SELECT IDTIPOUSUARIO FROM USUARIO WHERE IDUSUARIO = v_usuario AND ESTADO = 'Activo');
    END IF;
    IF v_tipo IS NULL THEN
        SET p_Mensaje = IF(v_usuario IS NULL, 'El rol no existe.', 'El usuario no existe o está inactivo.'); LEAVE proc;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM SUBMODULO WHERE IDSUBMODULO = p_IdSubmodulo AND ACTIVO = 1) THEN
        SET p_Mensaje = 'El submódulo no existe o está inactivo.'; LEAVE proc;
    END IF;
    IF NOT p_Asignar AND fn_acceso_protegido(v_tipo, p_IdSubmodulo) THEN
        SET p_Mensaje = 'El administrador siempre ve Accesos por rol, para no perder el control del sistema.'; LEAVE proc;
    END IF;

    IF v_usuario IS NULL THEN
        IF p_Asignar THEN
            DELETE FROM GRUPO_SUBMODULO_EXCLUIDO WHERE IDTIPOUSUARIO = v_tipo AND IDSUBMODULO = p_IdSubmodulo;
        ELSE
            INSERT IGNORE INTO GRUPO_SUBMODULO_EXCLUIDO (IDGRUPOEXCLSUB, IDTIPOUSUARIO, IDSUBMODULO, FECHAREGISTRO)
            VALUES (CONCAT('GSE_', REPLACE(UUID(), '-', '')), v_tipo, p_IdSubmodulo, v_fecha);
        END IF;
    ELSE
        SET v_rol_excluye = EXISTS (
            SELECT 1 FROM GRUPO_SUBMODULO_EXCLUIDO WHERE IDTIPOUSUARIO = v_tipo AND IDSUBMODULO = p_IdSubmodulo
        );
        IF p_Asignar THEN
            DELETE FROM USUARIO_SUBMODULO_EXCLUIDO WHERE IDUSUARIO = v_usuario AND IDSUBMODULO = p_IdSubmodulo;
            IF v_rol_excluye THEN
                INSERT IGNORE INTO USUARIO_SUBMODULO_INCLUIDO (IDUSUARIOINCLSUB, IDUSUARIO, IDSUBMODULO, FECHAREGISTRO)
                VALUES (CONCAT('USI_', REPLACE(UUID(), '-', '')), v_usuario, p_IdSubmodulo, v_fecha);
            ELSE
                DELETE FROM USUARIO_SUBMODULO_INCLUIDO WHERE IDUSUARIO = v_usuario AND IDSUBMODULO = p_IdSubmodulo;
            END IF;
        ELSE
            DELETE FROM USUARIO_SUBMODULO_INCLUIDO WHERE IDUSUARIO = v_usuario AND IDSUBMODULO = p_IdSubmodulo;
            IF NOT v_rol_excluye THEN
                INSERT IGNORE INTO USUARIO_SUBMODULO_EXCLUIDO (IDUSUARIOEXCLSUB, IDUSUARIO, IDSUBMODULO, FECHAREGISTRO)
                VALUES (CONCAT('USE_', REPLACE(UUID(), '-', '')), v_usuario, p_IdSubmodulo, v_fecha);
            END IF;
        END IF;
    END IF;

    SET p_Resultado = 1;
    SET p_Mensaje = IF(p_Asignar, 'Submódulo con acceso.', 'Submódulo sin acceso.');
END$$

DELIMITER ;
