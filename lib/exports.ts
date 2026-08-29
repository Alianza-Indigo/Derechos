import jsPDF from "jspdf";
import * as XLSX from "xlsx";

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

export function toXlsxBuffer(sheetName: string, rows: Array<Record<string, unknown>>) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildInstitutionalPdf(title: string, rows: Array<Record<string, unknown>>) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleString("es-MX")}`, 14, 27);
  doc.text("Filtros aplicados: segun seleccion de usuario autorizado", 14, 34);
  rows.slice(0, 24).forEach((row, index) => {
    doc.text(Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(" | ").slice(0, 110), 14, 46 + index * 7);
  });
  return Buffer.from(doc.output("arraybuffer"));
}
