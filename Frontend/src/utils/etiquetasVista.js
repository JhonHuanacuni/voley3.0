/** Etiquetas del menú: la clave `page` es la fuente de verdad (menu_config). */
const ETIQUETA_POR_PAGE = {
  "mantenedores-tutores": "Tutores",
};

/** Textos legacy en BD antes de migraciones de menú. */
const ALIAS_MENU = {};

export function etiquetaMenu(nombre, page) {
  if (page && ETIQUETA_POR_PAGE[page]) {
    return ETIQUETA_POR_PAGE[page];
  }
  return ALIAS_MENU[nombre] || nombre;
}
