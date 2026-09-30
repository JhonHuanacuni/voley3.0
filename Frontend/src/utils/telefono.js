/** Normaliza celular peruano y devuelve URL wa.me, o null si no hay número válido. */
export function whatsappUrl(telefono) {
  const digits = String(telefono || "").replace(/\D/g, "");
  if (!digits) return null;

  let num = digits;
  if (digits.length === 9 && digits.startsWith("9")) {
    num = `51${digits}`;
  } else if (digits.length === 10 && digits.startsWith("0")) {
    num = `51${digits.slice(1)}`;
  } else if (digits.length === 11 && digits.startsWith("51")) {
    num = digits;
  } else if (digits.length < 9) {
    return null;
  }

  return `https://wa.me/${num}`;
}

export function telefonoContactoUsuario(row) {
  return row?.TELPERSONAL || row?.TELAPODERADO || "";
}
