import { NextRequest, NextResponse } from "next/server";
import { buildInstitutionalPdf, toCsv, toXlsxBuffer } from "@/lib/exports";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { hasAnyPermission } from "@/server/permissions/rbac";
import { getAssistantData, getConfiguration, getCurrentUser, getOperationsData, getPrevalenceData, getTerritories, listCases, listEvents, listMembers } from "@/server/queries/app";

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
  const rows = await getRows(type, request.nextUrl.searchParams);

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

async function getRows(type: string, params: URLSearchParams): Promise<Array<Record<string, unknown>>> {
  if (type === "cases" || type === "urgent_cases" || type === "case_pdf") {
    const filters = {
      q: params.get("q") ?? undefined,
      category: params.get("category") ?? undefined,
      status: params.get("status") ?? undefined,
      priority: type === "urgent_cases" ? "Urgente" : params.get("priority") ?? undefined,
      territoryId: params.get("territoryId") ?? undefined,
      assignedTo: params.get("assignedTo") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    };
    const rows = await listCases(filters);
    return rows.map(({ id, caseNumber, title, category, priority, status, territoryId }) => ({ id, caseNumber, title, category, priority, status, territoryId }));
  }
  if (type === "events" || type === "event_pdf") {
    const rows = await listEvents(params.get("q") ?? undefined);
    return rows.map(({ id, title, eventType, dateStart, attendeesCount, territoryId }) => ({ id, title, eventType, dateStart, attendeesCount, territoryId }));
  }
  if (type === "prevalence") {
    const data = await getPrevalenceData();
    return data.records.map(({ id, metricId, territoryId, valueNumeric, sampleSize, source, measuredAt }) => ({ id, metricId, territoryId, valueNumeric, sampleSize, source, measuredAt }));
  }
  if (type === "field_operations") {
    const data = await getOperationsData();
    return data.fieldCommissions.map(({ id, title, commissionType, assignedTo, territoryId, status, scheduledAt, checkIns }) => ({
      id, title, commissionType, assignedTo, territoryId, status, scheduledAt, checkIns: checkIns.length,
    }));
  }
  if (type === "ai_usage") {
    const data = await getAssistantData();
    return data.conversations.map(({ id, title, status, userId, promptTemplateId, createdAt, messages }) => ({
      id, title, status, userId, promptTemplateId, createdAt, mensajes: messages.length,
    }));
  }
  if (type === "territory_reach") {
    const [members, events, territories] = await Promise.all([listMembers(), listEvents(), getTerritories()]);
    return territories.map((territory) => ({
      territoryId: territory.id,
      territorio: territory.name,
      tipo: territory.type,
      miembros: members.filter((member) => member.territoryId === territory.id).length,
      eventos: events.filter((event) => event.territoryId === territory.id).length,
      asistentes: events.filter((event) => event.territoryId === territory.id).reduce((sum, event) => sum + event.attendeesCount, 0),
    }));
  }
  const rows = await listMembers(params.get("q") ?? undefined);
  return rows.map(({ id, memberNumber, fullName, status, joinedAt, territoryId }) => ({ id, memberNumber, fullName, status, joinedAt, territoryId }));
}
