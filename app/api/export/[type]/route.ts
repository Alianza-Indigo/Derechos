import { NextRequest, NextResponse } from "next/server";
import { buildInstitutionalPdf, toCsv, toXlsxBuffer } from "@/lib/exports";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { hasAnyPermission } from "@/server/permissions/rbac";
import { getConfiguration, getCurrentUser, getPrevalenceData, listCases, listEvents, listMembers } from "@/server/queries/app";

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const limit = await rateLimit(clientKey(request, "export"), 40, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Limite de exportaciones alcanzado." }, { status: 429 });
  }
  const user = await getCurrentUser();
  if (!hasAnyPermission(user, ["reports:export", "*"])) {
    return NextResponse.json({ error: "No autorizado para exportar." }, { status: 403 });
  }

  const { type } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  const rows = await getRows(type);

  if (format === "xlsx") {
    return new NextResponse(new Uint8Array(toXlsxBuffer(type, rows)), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${type}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const { organization } = await getConfiguration();
    const buffer = buildInstitutionalPdf(`Reporte ${type}`, rows, {
      orgName: organization.name,
      generatedBy: user.name,
      filters: request.nextUrl.searchParams.toString() || "sin filtros",
    });
    return new NextResponse(new Uint8Array(buffer), {
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

async function getRows(type: string): Promise<Array<Record<string, unknown>>> {
  if (type === "cases" || type === "urgent_cases" || type === "case_pdf") {
    const rows = await listCases();
    return rows
      .filter((record) => type !== "urgent_cases" || record.priority === "Urgente")
      .map(({ id, caseNumber, title, category, priority, status, territoryId }) => ({ id, caseNumber, title, category, priority, status, territoryId }));
  }
  if (type === "events" || type === "event_pdf") {
    const rows = await listEvents();
    return rows.map(({ id, title, eventType, dateStart, attendeesCount, territoryId }) => ({ id, title, eventType, dateStart, attendeesCount, territoryId }));
  }
  if (type === "prevalence") {
    const data = await getPrevalenceData();
    return data.records.map(({ id, metricId, territoryId, valueNumeric, sampleSize, source, measuredAt }) => ({ id, metricId, territoryId, valueNumeric, sampleSize, source, measuredAt }));
  }
  const rows = await listMembers();
  return rows.map(({ id, memberNumber, fullName, status, joinedAt, territoryId }) => ({ id, memberNumber, fullName, status, joinedAt, territoryId }));
}
