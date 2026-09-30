import ExcelJS from "exceljs";

function cellValue(cell) {
  if (!cell || cell.value == null) return "";
  const v = cell.value;
  if (typeof v === "object" && v !== null) {
    if (v.result != null) return v.result;
    if (v.text != null) return v.text;
    if (v.richText) return v.richText.map((t) => t.text).join("");
  }
  return v;
}

/** Lee la primera hoja de un Excel y devuelve filas como objetos { columna: valor }. */
export async function parseExcelFile(file) {
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headerRow = ws.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const label = String(cellValue(cell) || "").trim() || `Column${colNumber}`;
    headers[colNumber] = label;
  });

  const maxCol = headers.length - 1;
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    for (let c = 1; c <= maxCol; c += 1) {
      const key = headers[c];
      if (!key) continue;
      obj[key] = cellValue(row.getCell(c));
    }
    rows.push(obj);
  });
  return rows;
}
