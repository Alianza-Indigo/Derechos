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
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 16;
  const lineHeight = 7;
  const maxWidth = doc.internal.pageSize.getWidth() - 28;

  const header = () => {
    doc.setFontSize(16);
    doc.text(title, 14, 18);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString("es-MX")}`, 14, 27);
    doc.text("Filtros aplicados: segun seleccion de usuario autorizado", 14, 34);
  };

  header();
  let y = 46;

  rows.forEach((row) => {
    const text = Object.entries(row)
      .map(([key, value]) => `${key}: ${value ?? ""}`)
      .join(" | ");
    // Envuelve el texto en varias lineas en vez de recortarlo.
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      if (y > pageHeight - bottomMargin) {
        doc.addPage();
        header();
        y = 46;
      }
      doc.text(line, 14, y);
      y += lineHeight;
    }
    y += 1;
  });

  return Buffer.from(doc.output("arraybuffer"));
}
