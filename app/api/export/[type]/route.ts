import { NextRequest, NextResponse } from "next/server";
import { buildInstitutionalPdf, toCsv, toXlsxBuffer } from "@/lib/exports";
import { cases, events, members, prevalenceRecords } from "@/lib/mock-data";

const sources: Record<string, Array<Record<string, unknown>>> = {
  members: members.map(({ id, memberNumber, fullName, status, joinedAt, territoryId }) => ({ id, memberNumber, fullName, status, joinedAt, territoryId })),
  cases: cases.map(({ id, caseNumber, title, category, priority, status, territoryId }) => ({ id, caseNumber, title, category, priority, status, territoryId })),
  events: events.map(({ id, title, eventType, dateStart, attendeesCount, territoryId }) => ({ id, title, eventType, dateStart, attendeesCount, territoryId })),
  prevalence: prevalenceRecords.map(({ id, metricId, territoryId, valueNumeric, sampleSize, source, measuredAt }) => ({ id, metricId, territoryId, valueNumeric, sampleSize, source, measuredAt })),
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const rows = sources[type] ?? sources.members;

  if (format === "xlsx") {
    return new NextResponse(new Uint8Array(toXlsxBuffer(type, rows)), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${type}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    return new NextResponse(new Uint8Array(buildInstitutionalPdf(`Reporte ${type}`, rows)), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${type}.pdf"`,
      },
    });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${type}.csv"`,
    },
  });
}
