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

type PdfMeta = {
  orgName?: string;
  generatedBy?: string;
  filters?: string;
};

export function buildInstitutionalPdf(title: string, rows: Array<Record<string, unknown>>, meta: PdfMeta = {}) {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = doc.internal.pageSize.getWidth() - 28;
  const lineHeight = 7;
  const bottomMargin = 16;

  const header = () => {
    if (meta.orgName) {
      doc.setFontSize(11);
      doc.text(meta.orgName, 14, 14);
    }
    doc.setFontSize(16);
    doc.text(title, 14, 24);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString("es-MX")}`, 14, 32);
    doc.text(`Generado por: ${meta.generatedBy ?? "Usuario autorizado"}`, 14, 38);
    doc.text(`Filtros: ${meta.filters ?? "seleccion de usuario autorizado"}`, 14, 44);
  };

  header();
  let y = 54;
  rows.forEach((row) => {
    const text = Object.entries(row).map(([key, value]) => `${key}: ${value ?? ""}`).join(" | ");
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      if (y > pageHeight - bottomMargin) {
        doc.addPage();
        header();
        y = 54;
      }
      doc.text(line, 14, y);
      y += lineHeight;
    }
    y += 1;
  });

  return Buffer.from(doc.output("arraybuffer"));
}
