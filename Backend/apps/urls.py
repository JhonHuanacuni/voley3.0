from django.urls import path

from apps.academia import controller as academia
from apps.auth import controller as auth

urlpatterns = [
    path('login/', auth.login, name='login'),
    path('menu-usuario/', auth.menu_usuario, name='menu_usuario'),
    path('catalogos/', academia.catalogos_view, name='catalogos'),
    path('dashboard/', academia.dashboard_view, name='dashboard'),
    path('asistencia/dia/', academia.asistencia_dia_view, name='asistencia_dia'),
    path('asistencia/marcar/', academia.asistencia_marcar_view, name='asistencia_marcar'),
    path('<slug:nombre>/', academia.entidad, name='entidad_lista'),
    path('<slug:nombre>/<str:id_registro>/', academia.entidad, name='entidad_detalle'),
]
