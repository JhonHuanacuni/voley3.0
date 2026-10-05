USE `VoleyDB`;

DROP PROCEDURE IF EXISTS usp_alumna_listar;
DROP PROCEDURE IF EXISTS usp_alumna_obtener;
DROP PROCEDURE IF EXISTS usp_alumna_insertar;
DROP PROCEDURE IF EXISTS usp_alumna_actualizar;
DROP PROCEDURE IF EXISTS usp_alumna_eliminar;
DROP PROCEDURE IF EXISTS usp_alumna_combo;
DROP PROCEDURE IF EXISTS usp_alumna_dias_guardar;

DELIMITER $$

-- Opciones de los buscadores de alumna en formularios.
-- Con p_IdAlumna devuelve solo esa alumna (para mostrar el valor ya elegido al editar).
-- El nombre se devuelve en mayúsculas para que todos los buscadores lo muestren igual.
CREATE PROCEDURE usp_alumna_combo(IN p_Texto VARCHAR(100), IN p_IdAlumna VARCHAR(50), IN p_Limite INT)
BEGIN
    DECLARE v_t VARCHAR(100);
    DECLARE v_limite INT;
    SET v_t = TRIM(IFNULL(p_Texto, ''));
    SET v_limite = IF(p_Limite IS NULL OR p_Limite < 1 OR p_Limite > 50, 20, p_Limite);
    IF IFNULL(p_IdAlumna, '') <> '' THEN
        SELECT IDALUMNA, UPPER(NOMBRE) AS NOMBRE, IFNULL(DNI, '') AS DNI, IFNULL(EMAIL, '') AS EMAIL, IFNULL(TELEFONO, '') AS TELEFONO
        FROM ALUMNA
        WHERE IDALUMNA = p_IdAlumna;
    ELSE
        SELECT IDALUMNA, UPPER(NOMBRE) AS NOMBRE, IFNULL(DNI, '') AS DNI, IFNULL(EMAIL, '') AS EMAIL, IFNULL(TELEFONO, '') AS TELEFONO
        FROM ALUMNA
        WHERE ESTADO <> 'Retirada'
          AND (v_t = ''
               OR NOMBRE LIKE CONCAT('%', v_t, '%')
               OR IFNULL(DNI, '') LIKE CONCAT(v_t, '%')
               OR IFNULL(EMAIL, '') LIKE CONCAT('%', v_t, '%')
               OR IFNULL(TELEFONO, '') LIKE CONCAT('%', v_t, '%'))
        ORDER BY NOMBRE
        LIMIT v_limite;
    END IF;
END$$

-- El rango de fechas se aplica a la inscripción; en el listado de retiradas, a la fecha de retiro.
CREATE PROCEDURE usp_alumna_listar(
    IN p_Buscar VARCHAR(200), IN p_Estado VARCHAR(20), IN p_IdCiclo VARCHAR(50), IN p_IdTurno VARCHAR(50),
    IN p_Desde CHAR(8), IN p_Hasta CHAR(8),
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
    FROM ALUMNA a
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR a.NOMBRE LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(a.DNI, '') LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(a.APODERADO, '') LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(a.TELAPODERADO, '') LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR a.ESTADO = p_Estado)
      AND (p_IdCiclo IS NULL OR p_IdCiclo = '' OR a.IDCICLO = p_IdCiclo)
      AND (p_IdTurno IS NULL OR p_IdTurno = '' OR a.IDTURNO = p_IdTurno)
      AND (v_desde IS NULL OR STR_TO_DATE(NULLIF(IF(p_Estado = 'Retirada', a.FECHARETIRO, a.FECHAINSCRIPCION), ''), '%d%m%Y') >= v_desde)
      AND (v_hasta IS NULL OR STR_TO_DATE(NULLIF(IF(p_Estado = 'Retirada', a.FECHARETIRO, a.FECHAINSCRIPCION), ''), '%d%m%Y') <= v_hasta);

    SELECT a.IDALUMNA, a.NOMBRE, a.DNI, a.EDAD, a.ESTADO, a.CONDICION, a.TELAPODERADO,
           c.NOMBRE AS CICLO, t.NOMBRE AS TURNO, a.FINMENSUALIDAD, a.FECHAINSCRIPCION, a.FECHARETIRO
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
    WHERE (p_Buscar IS NULL OR p_Buscar = '' OR a.NOMBRE LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(a.DNI, '') LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(a.APODERADO, '') LIKE CONCAT('%', p_Buscar, '%')
           OR IFNULL(a.TELAPODERADO, '') LIKE CONCAT('%', p_Buscar, '%'))
      AND (p_Estado IS NULL OR p_Estado = '' OR a.ESTADO = p_Estado)
      AND (p_IdCiclo IS NULL OR p_IdCiclo = '' OR a.IDCICLO = p_IdCiclo)
      AND (p_IdTurno IS NULL OR p_IdTurno = '' OR a.IDTURNO = p_IdTurno)
      AND (v_desde IS NULL OR STR_TO_DATE(NULLIF(IF(p_Estado = 'Retirada', a.FECHARETIRO, a.FECHAINSCRIPCION), ''), '%d%m%Y') >= v_desde)
      AND (v_hasta IS NULL OR STR_TO_DATE(NULLIF(IF(p_Estado = 'Retirada', a.FECHARETIRO, a.FECHAINSCRIPCION), ''), '%d%m%Y') <= v_hasta)
    ORDER BY
        CASE WHEN p_Direccion = 'DESC' THEN a.NOMBRE END DESC,
        a.NOMBRE
    LIMIT v_off, p_Tamanio;
END$$

CREATE PROCEDURE usp_alumna_obtener(IN p_Id VARCHAR(50))
BEGIN
    SELECT a.IDALUMNA, a.NOMBRE, a.EDAD, a.DNI, a.EMAIL, a.TELEFONO, a.GENERO, a.IDCICLO,
           a.CONDICION, a.COLEGIO, a.TALLA, a.SUFREDE, a.COMOENTERO,
           IF(a.UNIFORMEENTREGADO = 1, 'SI', 'NO') AS UNIFORMEENTREGADO,
           a.APODERADO, a.DNIAPODERADO, a.FECHANACAPODERADO, a.GENEROAPODERADO, a.TELAPODERADO,
           a.DIRECCION, a.IDTURNO, a.DIASASISTENCIA, a.ESTADO, a.MOTIVORETIRO, a.FECHARETIRO, a.MENSUALIDAD,
           a.FECHAINSCRIPCION, a.INICIOMENSUALIDAD, a.FINMENSUALIDAD, a.FECHANACIMIENTO,
           c.NOMBRE AS CICLO, t.NOMBRE AS TURNO
    FROM ALUMNA a
    LEFT JOIN CICLO c ON c.IDCICLO = a.IDCICLO
    LEFT JOIN TURNO t ON t.IDTURNO = a.IDTURNO
    WHERE a.IDALUMNA = p_Id;
END$$

CREATE PROCEDURE usp_alumna_insertar(
    IN p_Nombre VARCHAR(120), IN p_Edad SMALLINT, IN p_Dni VARCHAR(15), IN p_Email VARCHAR(150),
    IN p_Telefono VARCHAR(200), IN p_Genero VARCHAR(20), IN p_IdCiclo VARCHAR(50), IN p_Condicion VARCHAR(30),
    IN p_Colegio VARCHAR(120), IN p_Talla VARCHAR(5), IN p_Sufre VARCHAR(255), IN p_Como VARCHAR(200),
    IN p_Uniforme TINYINT, IN p_Apoderado VARCHAR(120), IN p_DniApo VARCHAR(15), IN p_FecNacApo CHAR(8),
    IN p_GeneroApo VARCHAR(20), IN p_TelApo VARCHAR(200), IN p_Direccion VARCHAR(500), IN p_IdTurno VARCHAR(50),
    IN p_Estado VARCHAR(20), IN p_Motivo VARCHAR(500), IN p_FecRetiro CHAR(8), IN p_Mensualidad DECIMAL(10,2),
    IN p_FecIns CHAR(8), IN p_IniMen CHAR(8), IN p_FinMen CHAR(8), IN p_FecNac CHAR(8), IN p_Dias VARCHAR(120),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200), OUT p_Id VARCHAR(50)
)
proc: BEGIN
    DECLARE v_id VARCHAR(50);
    IF p_Nombre IS NULL OR TRIM(p_Nombre) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el nombre de la alumna.'; LEAVE proc;
    END IF;
    IF p_IdCiclo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM CICLO WHERE IDCICLO = p_IdCiclo) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'El ciclo no existe.'; LEAVE proc;
    END IF;
    IF p_IdTurno IS NOT NULL AND NOT EXISTS (SELECT 1 FROM TURNO WHERE IDTURNO = p_IdTurno) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'El turno no existe.'; LEAVE proc;
    END IF;
    SELECT CONCAT('ALU', LPAD(IFNULL(MAX(CAST(SUBSTRING(IDALUMNA, 4) AS UNSIGNED)), 0) + 1, 6, '0'))
      INTO v_id FROM ALUMNA;
    INSERT INTO ALUMNA (
        IDALUMNA, NOMBRE, EDAD, DNI, EMAIL, TELEFONO, GENERO, IDCICLO, CONDICION, COLEGIO, TALLA,
        SUFREDE, COMOENTERO, UNIFORMEENTREGADO, APODERADO, DNIAPODERADO, FECHANACAPODERADO,
        GENEROAPODERADO, TELAPODERADO, DIRECCION, IDTURNO, DIASASISTENCIA, ESTADO, MOTIVORETIRO, FECHARETIRO,
        MENSUALIDAD, FECHAINSCRIPCION, INICIOMENSUALIDAD, FINMENSUALIDAD, FECHANACIMIENTO, FECHACREACION
    ) VALUES (
        v_id, TRIM(p_Nombre), p_Edad, NULLIF(TRIM(IFNULL(p_Dni, '')), ''), NULLIF(TRIM(IFNULL(p_Email, '')), ''),
        p_Telefono, p_Genero, p_IdCiclo, IFNULL(NULLIF(TRIM(IFNULL(p_Condicion, '')), ''), 'Regular'),
        p_Colegio, p_Talla, p_Sufre, p_Como, IFNULL(p_Uniforme, 0), p_Apoderado, p_DniApo, p_FecNacApo,
        p_GeneroApo, p_TelApo, p_Direccion, p_IdTurno, NULLIF(TRIM(IFNULL(p_Dias, '')), ''),
        IFNULL(NULLIF(TRIM(IFNULL(p_Estado, '')), ''), 'Activa'),
        p_Motivo, p_FecRetiro, p_Mensualidad, p_FecIns, p_IniMen, p_FinMen, p_FecNac,
        DATE_FORMAT(NOW(), '%d%m%Y')
    );
    SET p_Resultado = 1; SET p_Mensaje = 'Alumna registrada.'; SET p_Id = v_id;
END$$

CREATE PROCEDURE usp_alumna_actualizar(
    IN p_Id VARCHAR(50),
    IN p_Nombre VARCHAR(120), IN p_Edad SMALLINT, IN p_Dni VARCHAR(15), IN p_Email VARCHAR(150),
    IN p_Telefono VARCHAR(200), IN p_Genero VARCHAR(20), IN p_IdCiclo VARCHAR(50), IN p_Condicion VARCHAR(30),
    IN p_Colegio VARCHAR(120), IN p_Talla VARCHAR(5), IN p_Sufre VARCHAR(255), IN p_Como VARCHAR(200),
    IN p_Uniforme TINYINT, IN p_Apoderado VARCHAR(120), IN p_DniApo VARCHAR(15), IN p_FecNacApo CHAR(8),
    IN p_GeneroApo VARCHAR(20), IN p_TelApo VARCHAR(200), IN p_Direccion VARCHAR(500), IN p_IdTurno VARCHAR(50),
    IN p_Estado VARCHAR(20), IN p_Motivo VARCHAR(500), IN p_FecRetiro CHAR(8), IN p_Mensualidad DECIMAL(10,2),
    IN p_FecIns CHAR(8), IN p_IniMen CHAR(8), IN p_FinMen CHAR(8), IN p_FecNac CHAR(8), IN p_Dias VARCHAR(120),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    IF NOT EXISTS (SELECT 1 FROM ALUMNA WHERE IDALUMNA = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La alumna no existe.'; LEAVE proc;
    END IF;
    IF p_Nombre IS NULL OR TRIM(p_Nombre) = '' THEN
        SET p_Resultado = 0; SET p_Mensaje = 'Ingresa el nombre de la alumna.'; LEAVE proc;
    END IF;
    UPDATE ALUMNA SET
        NOMBRE = TRIM(p_Nombre), EDAD = p_Edad, DNI = NULLIF(TRIM(IFNULL(p_Dni, '')), ''),
        EMAIL = NULLIF(TRIM(IFNULL(p_Email, '')), ''), TELEFONO = p_Telefono, GENERO = p_Genero,
        IDCICLO = p_IdCiclo, CONDICION = IFNULL(NULLIF(TRIM(IFNULL(p_Condicion, '')), ''), 'Regular'),
        COLEGIO = p_Colegio, TALLA = p_Talla, SUFREDE = p_Sufre, COMOENTERO = p_Como,
        UNIFORMEENTREGADO = IFNULL(p_Uniforme, 0), APODERADO = p_Apoderado, DNIAPODERADO = p_DniApo,
        FECHANACAPODERADO = p_FecNacApo, GENEROAPODERADO = p_GeneroApo, TELAPODERADO = p_TelApo,
        DIRECCION = p_Direccion, IDTURNO = p_IdTurno, DIASASISTENCIA = NULLIF(TRIM(IFNULL(p_Dias, '')), ''),
        ESTADO = IFNULL(NULLIF(TRIM(IFNULL(p_Estado, '')), ''), ESTADO),
        MOTIVORETIRO = p_Motivo, FECHARETIRO = p_FecRetiro, MENSUALIDAD = p_Mensualidad,
        FECHAINSCRIPCION = p_FecIns, INICIOMENSUALIDAD = p_IniMen, FINMENSUALIDAD = p_FinMen,
        FECHANACIMIENTO = p_FecNac
    WHERE IDALUMNA = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Alumna actualizada.';
END$$

-- Días que asiste, elegidos al registrar la matrícula. Vacío: todos los días de su turno.
CREATE PROCEDURE usp_alumna_dias_guardar(
    IN p_Id VARCHAR(50), IN p_Dias VARCHAR(120),
    OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200)
)
proc: BEGIN
    IF NOT EXISTS (SELECT 1 FROM ALUMNA WHERE IDALUMNA = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La alumna no existe.'; LEAVE proc;
    END IF;
    UPDATE ALUMNA SET DIASASISTENCIA = NULLIF(TRIM(IFNULL(p_Dias, '')), '') WHERE IDALUMNA = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Días guardados.';
END$$

CREATE PROCEDURE usp_alumna_eliminar(IN p_Id VARCHAR(50), OUT p_Resultado INT, OUT p_Mensaje VARCHAR(200))
proc: BEGIN
    IF NOT EXISTS (SELECT 1 FROM ALUMNA WHERE IDALUMNA = p_Id) THEN
        SET p_Resultado = 0; SET p_Mensaje = 'La alumna no existe.'; LEAVE proc;
    END IF;
    DELETE FROM ALUMNA WHERE IDALUMNA = p_Id;
    SET p_Resultado = 1; SET p_Mensaje = 'Alumna eliminada.';
END$$

DELIMITER ;
