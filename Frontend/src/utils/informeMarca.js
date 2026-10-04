import logoUrl from "../images/logo.jpg";

export const ACADEMIA = {
  nombre: "ACADEMIA VITA VOLEY",
  eslogan: "¡Tu límite es el cosmos!",
  documento: "Documento interno · Uso gerencial",
  confidencial: "Información confidencial. Prohibida su distribución sin autorización de la gerencia.",
};

export const MARCA = {
  primario: "#d15381",
  oscuro: "#9d2f58",
  medio: "#b8436c",
  suave: "#f8e6ed",
  zebra: "#fdf4f8",
  texto: "#1c2333",
  gris: "#6b7280",
  linea: "#e8d3dc",
  blanco: "#ffffff",
};

export function argb(hex) {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

export function rgb(hex) {
  const limpio = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(limpio.slice(i, i + 2), 16));
}

export function formatearFechaEmision(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
}

export function usuarioSesion() {
  return String(localStorage.getItem("idusuario") || "").toUpperCase();
}

const LOGO = { promesa: null };

/** Devuelve { buffer, dataUrl, ancho, alto } o null si el logo no se pudo leer. */
export function cargarLogo() {
  if (!LOGO.promesa) {
    LOGO.promesa = (async () => {
      try {
        const res = await fetch(logoUrl);
        if (!res.ok) return null;
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();
        const dataUrl = await new Promise((resolve, reject) => {
          const lector = new FileReader();
          lector.onload = () => resolve(lector.result);
          lector.onerror = reject;
          lector.readAsDataURL(blob);
        });
        const { ancho, alto } = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ ancho: img.naturalWidth, alto: img.naturalHeight });
          img.onerror = () => resolve({ ancho: 1, alto: 1 });
          img.src = dataUrl;
        });
        return { buffer, dataUrl, ancho, alto };
      } catch {
        LOGO.promesa = null;
        return null;
      }
    })();
  }
  return LOGO.promesa;
}
