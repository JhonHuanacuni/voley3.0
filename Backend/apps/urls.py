from django.urls import path

from apps.academia import controller as academia
from apps.accesos import controller as accesos
from apps.auth import controller as auth

urlpatterns = [
    path('login/', auth.login, name='login'),
    path('logout/', auth.logout, name='logout'),
    path('menu-usuario/', auth.menu_usuario, name='menu_usuario'),
    path('accesos/roles/', accesos.roles_view, name='accesos_roles'),
    path('accesos/usuarios/', accesos.usuarios_view, name='accesos_usuarios'),
    path('accesos/modulos/', accesos.modulos_view, name='accesos_modulos'),
    path('accesos/submodulos/', accesos.submodulos_view, name='accesos_submodulos'),
    path('catalogos/', academia.catalogos_view, name='catalogos'),
    path('dashboard/', academia.dashboard_view, name='dashboard'),
    path('dashboard/matriculas/', academia.dashboard_matriculas_view, name='dashboard_matriculas'),
    path('dashboard/asistencias/', academia.dashboard_asistencias_view, name='dashboard_asistencias'),
    path('dashboard/finanzas/', academia.dashboard_finanzas_view, name='dashboard_finanzas'),
    path('asistencia/dia/', academia.asistencia_dia_view, name='asistencia_dia'),
    path('asistencia/marcar/', academia.asistencia_marcar_view, name='asistencia_marcar'),
    path('ventas/<str:id_registro>/anular/', academia.venta_anular_view, name='venta_anular'),
    path('ventas/<str:id_registro>/abonos/', academia.venta_abonos_view, name='venta_abonos'),
    path('abonos/<str:id_abono>/anular/', academia.abono_anular_view, name='abono_anular'),
    path('mensajes/vigentes/', academia.mensajes_vigentes_view, name='mensajes_vigentes'),
    path('mensualidades/<str:id_registro>/renovar/', academia.mensualidad_renovar_view, name='mensualidad_renovar'),
    path('alumnas/<str:id_registro>/reactivar/', academia.alumna_reactivar_view, name='alumna_reactivar'),
    path('estado-cuenta/<str:id_alumna>/', academia.estado_cuenta_view, name='estado_cuenta'),
    path('estado-cuenta/<str:id_alumna>/<slug:seccion>/', academia.estado_cuenta_seccion_view,
         name='estado_cuenta_seccion'),
    path('cumpleanos/', academia.cumpleanos_view, name='cumpleanos'),
    path('buscar-alumnas/', academia.buscar_alumnas_view, name='buscar_alumnas'),
    path('combo/alumnas/', academia.alumnas_combo_view, name='alumnas_combo'),
    path('combo/mensualidades/', academia.mensualidades_por_alumna_view, name='mensualidades_por_alumna'),
    path('deudas/', academia.deudas_view, name='deudas'),
    path('reportes/<slug:tipo>/', academia.reporte_view, name='reporte'),
    path('reportes-detalle/<slug:tipo>/', academia.reporte_detalle_view, name='reporte_detalle'),
    path('trazabilidad/<slug:nombre>/<str:id_registro>/', academia.trazabilidad_view, name='trazabilidad'),
    path('<slug:nombre>/', academia.entidad, name='entidad_lista'),
    path('<slug:nombre>/<str:id_registro>/', academia.entidad, name='entidad_detalle'),
]
