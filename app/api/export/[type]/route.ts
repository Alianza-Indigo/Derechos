import { NextRequest, NextResponse } from "next/server";
import { buildInstitutionalPdf, toCsv, toXlsxBuffer } from "@/lib/exports";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/options";
import { getPrevalenceData, listCases, listEvents, listMembers } from "@/server/queries/app";

async function buildRows(type: string): Promise<Array<Record<string, unknown>>> {
  switch (type) {
    case "cases": {
      const rows = await listCases();
      return rows.map(({ id, caseNumber, title, category, priority, status, territoryId }) => ({ id, caseNumber, title, category, priority, status, territoryId }));
    }
    case "events": {
      const rows = await listEvents();
      return rows.map(({ id, title, eventType, dateStart, attendeesCount, territoryId }) => ({ id, title, eventType, dateStart, attendeesCount, territoryId }));
    }
    case "prevalence": {
      const { records } = await getPrevalenceData();
      return records.map(({ id, metricId, territoryId, valueNumeric, sampleSize, source, measuredAt }) => ({ id, metricId, territoryId, valueNumeric, sampleSize, source, measuredAt }));
    }
    case "members":
    default: {
      const rows = await listMembers();
      return rows.map(({ id, memberNumber, fullName, status, joinedAt, territoryId }) => ({ id, memberNumber, fullName, status, joinedAt, territoryId }));
    }
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { type } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const rows = await buildRows(type);

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
