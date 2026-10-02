from django.urls import path

from apps.academia import controller as academia
from apps.auth import controller as auth

urlpatterns = [
    path('login/', auth.login, name='login'),
    path('menu-usuario/', auth.menu_usuario, name='menu_usuario'),
    path('catalogos/', academia.catalogos_view, name='catalogos'),
    path('dashboard/', academia.dashboard_view, name='dashboard'),
    path('dashboard/matriculas/', academia.dashboard_matriculas_view, name='dashboard_matriculas'),
    path('asistencia/dia/', academia.asistencia_dia_view, name='asistencia_dia'),
    path('asistencia/marcar/', academia.asistencia_marcar_view, name='asistencia_marcar'),
    path('ventas/control/', academia.ventas_control_view, name='ventas_control'),
    path('ventas/<str:id_registro>/anular/', academia.venta_anular_view, name='venta_anular'),
    path('ventas/<str:id_registro>/abonos/', academia.venta_abonos_view, name='venta_abonos'),
    path('abonos/<str:id_abono>/anular/', academia.abono_anular_view, name='abono_anular'),
    path('mensajes/vigentes/', academia.mensajes_vigentes_view, name='mensajes_vigentes'),
    path('mensualidades/<str:id_registro>/renovar/', academia.mensualidad_renovar_view, name='mensualidad_renovar'),
    path('estado-cuenta/<str:id_alumna>/', academia.estado_cuenta_view, name='estado_cuenta'),
    path('cumpleanos/', academia.cumpleanos_view, name='cumpleanos'),
    path('buscar-alumnas/', academia.buscar_alumnas_view, name='buscar_alumnas'),
    path('deudas/', academia.deudas_view, name='deudas'),
    path('reportes/<slug:tipo>/', academia.reporte_view, name='reporte'),
    path('trazabilidad/<slug:nombre>/<str:id_registro>/', academia.trazabilidad_view, name='trazabilidad'),
    path('<slug:nombre>/', academia.entidad, name='entidad_lista'),
    path('<slug:nombre>/<str:id_registro>/', academia.entidad, name='entidad_detalle'),
]
