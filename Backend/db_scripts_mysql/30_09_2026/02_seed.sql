USE `VoleyDB`;

INSERT INTO TIPOUSUARIO (IDTIPOUSUARIO, DESCRIPCION) VALUES
('1', 'Secretaria'),
('3', 'Administrador');

INSERT INTO TIPO_PERMISO (IDTIPOPERMISO, DESCRIPCION) VALUES
('TP001', 'VER'),
('TP002', 'CREAR'),
('TP003', 'EDITAR'),
('TP004', 'ELIMINAR');

INSERT INTO MODULO (IDMODULO, NOMBRE, DESCRIPCION, ICONO, ORDEN, ACTIVO, FECHACREACION) VALUES
('MOD001', 'Dashboard', 'Panel principal', 'faGauge', 1, 1, DATE_FORMAT(NOW(), '%d%m%Y')),
('MOD002', 'Academia', 'Alumnas, asistencia, mensualidades y pagos', 'faGraduationCap', 2, 1, DATE_FORMAT(NOW(), '%d%m%Y')),
('MOD003', 'Administración', 'Ciclos, turnos, ventas, egresos y usuarios', 'faCog', 3, 1, DATE_FORMAT(NOW(), '%d%m%Y'));

INSERT INTO SUBMODULO (IDSUBMODULO, NOMBRE, DESCRIPCION, ICONO, ORDEN, ACTIVO, IDMODULO) VALUES
('SUB001', 'Alumnas', 'Registro de alumnas', 'faUsers', 1, 1, 'MOD002'),
('SUB002', 'Asistencia', 'Pase de lista por turno', 'faCalendarCheck', 2, 1, 'MOD002'),
('SUB003', 'Mensualidades', 'Periodos de mensualidad', 'faIdCard', 3, 1, 'MOD002'),
('SUB004', 'Pagos', 'Pagos de mensualidad', 'faMoneyBill', 4, 1, 'MOD002'),
('SUB005', 'Retiradas', 'Alumnas dadas de baja', 'faUserSlash', 5, 1, 'MOD002'),
('SUB006', 'Ciclos', 'Categorías de la academia', 'faLayerGroup', 1, 1, 'MOD003'),
('SUB007', 'Turnos', 'Horarios y días', 'faClock', 2, 1, 'MOD003'),
('SUB008', 'Ventas', 'Uniformes y productos', 'faShirt', 3, 1, 'MOD003'),
('SUB009', 'Egresos', 'Gastos de la academia', 'faMoneyBillWave', 4, 1, 'MOD003'),
('SUB010', 'Usuarios', 'Accesos al sistema', 'faKey', 5, 1, 'MOD003'),
('SUB011', 'Auditoría', 'Historial de cambios', 'faClipboardList', 6, 1, 'MOD003');

INSERT INTO GRUPO_MODULO (IDGRUPOMODULO, IDTIPOUSUARIO, IDMODULO, IDTIPOPERMISO) VALUES
('GM001', '1', 'MOD001', 'TP001'),
('GM002', '1', 'MOD001', 'TP002'),
('GM003', '1', 'MOD001', 'TP003'),
('GM004', '1', 'MOD001', 'TP004'),
('GM005', '1', 'MOD002', 'TP001'),
('GM006', '1', 'MOD002', 'TP002'),
('GM007', '1', 'MOD002', 'TP003'),
('GM008', '1', 'MOD002', 'TP004'),
('GM101', '3', 'MOD001', 'TP001'),
('GM102', '3', 'MOD001', 'TP002'),
('GM103', '3', 'MOD001', 'TP003'),
('GM104', '3', 'MOD001', 'TP004'),
('GM105', '3', 'MOD002', 'TP001'),
('GM106', '3', 'MOD002', 'TP002'),
('GM107', '3', 'MOD002', 'TP003'),
('GM108', '3', 'MOD002', 'TP004'),
('GM109', '3', 'MOD003', 'TP001'),
('GM110', '3', 'MOD003', 'TP002'),
('GM111', '3', 'MOD003', 'TP003'),
('GM112', '3', 'MOD003', 'TP004');

INSERT INTO USUARIO (IDUSUARIO, CONTRA, NOMBRE, APELLIDO, DNI, EMAIL, ESTADO, IDTIPOUSUARIO) VALUES
('vita', 'vita', 'VITA', 'VOLEY', '00000000', 'vita@voley.local', 'Activo', '3');
