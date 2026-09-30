from django.db import models


class TipoUsuario(models.Model):
    IDTIPOUSUARIO = models.CharField(max_length=50, primary_key=True)
    DESCRIPCION = models.CharField(max_length=255)

    class Meta:
        db_table = 'TIPOUSUARIO'
        managed = False


class Usuario(models.Model):
    IDUSUARIO = models.CharField(max_length=50, primary_key=True)
    CONTRA = models.CharField(max_length=255)
    NOMBRE = models.CharField(max_length=100)
    APELLIDO = models.CharField(max_length=100)
    DNI = models.CharField(max_length=20)
    ESTADO = models.CharField(max_length=50, default='Activo')
    EMAIL = models.CharField(max_length=150, blank=True, null=True)
    IDTIPOUSUARIO = models.ForeignKey(
        TipoUsuario, on_delete=models.DO_NOTHING, db_column='IDTIPOUSUARIO',
    )

    class Meta:
        db_table = 'USUARIO'
        managed = False


class TipoPermiso(models.Model):
    IDTIPOPERMISO = models.CharField(max_length=50, primary_key=True)
    DESCRIPCION = models.CharField(max_length=255)

    class Meta:
        db_table = 'TIPO_PERMISO'
        managed = False


class Modulo(models.Model):
    IDMODULO = models.CharField(max_length=50, primary_key=True)
    NOMBRE = models.CharField(max_length=100)
    DESCRIPCION = models.CharField(max_length=255, blank=True, null=True)
    ICONO = models.CharField(max_length=100, blank=True, null=True)
    ORDEN = models.IntegerField(blank=True, null=True)
    ACTIVO = models.BooleanField(default=True)

    class Meta:
        db_table = 'MODULO'
        managed = False
        ordering = ['ORDEN', 'NOMBRE']


class Submodulo(models.Model):
    IDSUBMODULO = models.CharField(max_length=50, primary_key=True)
    NOMBRE = models.CharField(max_length=100)
    ICONO = models.CharField(max_length=100, blank=True, null=True)
    ORDEN = models.IntegerField(blank=True, null=True)
    ACTIVO = models.BooleanField(default=True)
    IDMODULO = models.ForeignKey(Modulo, on_delete=models.CASCADE, db_column='IDMODULO')

    class Meta:
        db_table = 'SUBMODULO'
        managed = False
        ordering = ['ORDEN', 'NOMBRE']


class GrupoModulo(models.Model):
    IDGRUPOMODULO = models.CharField(max_length=50, primary_key=True)
    IDTIPOUSUARIO = models.CharField(max_length=50)
    IDMODULO = models.ForeignKey(Modulo, on_delete=models.CASCADE, db_column='IDMODULO')
    IDTIPOPERMISO = models.ForeignKey(TipoPermiso, on_delete=models.CASCADE, db_column='IDTIPOPERMISO')

    class Meta:
        db_table = 'GRUPO_MODULO'
        managed = False


class UsuarioModulo(models.Model):
    IDUSUARIOMODULO = models.CharField(max_length=50, primary_key=True)
    IDUSUARIO = models.CharField(max_length=50)
    IDMODULO = models.ForeignKey(Modulo, on_delete=models.CASCADE, db_column='IDMODULO')
    IDTIPOPERMISO = models.ForeignKey(TipoPermiso, on_delete=models.CASCADE, db_column='IDTIPOPERMISO')

    class Meta:
        db_table = 'USUARIO_MODULO'
        managed = False


class UsuarioModuloExcluido(models.Model):
    IDUSUARIOEXCLUIDO = models.CharField(max_length=50, primary_key=True)
    IDUSUARIO = models.CharField(max_length=50)
    IDMODULO = models.ForeignKey(Modulo, on_delete=models.CASCADE, db_column='IDMODULO')

    class Meta:
        db_table = 'USUARIO_MODULO_EXCLUIDO'
        managed = False


class UsuarioSubmoduloExcluido(models.Model):
    IDUSUARIOEXCLSUB = models.CharField(max_length=50, primary_key=True)
    IDUSUARIO = models.CharField(max_length=50)
    IDSUBMODULO = models.ForeignKey(Submodulo, on_delete=models.CASCADE, db_column='IDSUBMODULO')

    class Meta:
        db_table = 'USUARIO_SUBMODULO_EXCLUIDO'
        managed = False


class UsuarioSubmoduloIncluido(models.Model):
    IDUSUARIOINCLSUB = models.CharField(max_length=50, primary_key=True)
    IDUSUARIO = models.CharField(max_length=50)
    IDSUBMODULO = models.ForeignKey(Submodulo, on_delete=models.CASCADE, db_column='IDSUBMODULO')

    class Meta:
        db_table = 'USUARIO_SUBMODULO_INCLUIDO'
        managed = False


class GrupoSubmoduloExcluido(models.Model):
    IDGRUPOEXCLSUB = models.CharField(max_length=50, primary_key=True)
    IDTIPOUSUARIO = models.CharField(max_length=50)
    IDSUBMODULO = models.ForeignKey(Submodulo, on_delete=models.CASCADE, db_column='IDSUBMODULO')

    class Meta:
        db_table = 'GRUPO_SUBMODULO_EXCLUIDO'
        managed = False
