import { NextRequest, NextResponse } from "next/server";
import { buildInstitutionalPdf, toCsv, toXlsxBuffer } from "@/lib/exports";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/server/audit/log";
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
  const filters = request.nextUrl.searchParams.toString() || "sin filtros";

  // Toda descarga de reporte queda registrada en auditoria (dato agregado sensible).
  await writeAuditLog({
    actorId: user.id,
    action: "report.export",
    entityType: "report",
    entityId: type,
    after: { format, filters, rows: rows.length },
    ip: request.headers.get("x-forwarded-for") ?? undefined,
  });

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
    const logo = await fetchLogoDataUrl(organization.logoUrl);
    const buffer = buildInstitutionalPdf(`Reporte ${type}`, rows, {
      orgName: organization.name,
      generatedBy: user.name,
      filters,
      logoDataUrl: logo,
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

// Descarga el logotipo institucional y lo convierte a data URL para incrustarlo
// en el PDF. Si falla (sin logo, red, formato no soportado) el PDF sigue sin logo.
async function fetchLogoDataUrl(logoUrl?: string | null): Promise<string | undefined> {
  if (!logoUrl || !/^https?:\/\//.test(logoUrl)) {
    return undefined;
  }
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      return undefined;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/image\/(png|jpe?g)/.test(contentType)) {
      return undefined;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > 1_000_000) {
      return undefined;
    }
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function inRange(value: string, from?: string | null, to?: string | null) {
  if (from && value < from) {
    return false;
  }
  if (to && value > `${to}T23:59:59.999Z`) {
    return false;
  }
  return true;
}

async function getRows(type: string, params: URLSearchParams): Promise<Array<Record<string, unknown>>> {
  const territoryId = params.get("territoryId") ?? undefined;
  const from = params.get("from");
  const to = params.get("to");
  if (type === "cases" || type === "urgent_cases" || type === "case_pdf") {
    const filters = {
      q: params.get("q") ?? undefined,
      category: params.get("category") ?? undefined,
      status: params.get("status") ?? undefined,
      priority: type === "urgent_cases" ? "Urgente" : params.get("priority") ?? undefined,
      territoryId,
      assignedTo: params.get("assignedTo") ?? undefined,
      from: from ?? undefined,
      to: to ?? undefined,
    };
    const rows = await listCases(filters);
    return rows.map(({ id, caseNumber, title, category, priority, status, territoryId }) => ({ id, caseNumber, title, category, priority, status, territoryId }));
  }
  if (type === "events" || type === "event_pdf") {
    const rows = await listEvents(params.get("q") ?? undefined);
    return rows
      .filter((event) => (territoryId ? event.territoryId === territoryId : true))
      .filter((event) => inRange(event.dateStart, from, to))
      .filter((event) => {
        const eventType = params.get("eventType");
        return eventType ? event.eventType === eventType : true;
      })
      .map(({ id, title, eventType, dateStart, attendeesCount, territoryId }) => ({ id, title, eventType, dateStart, attendeesCount, territoryId }));
  }
  if (type === "prevalence") {
    const data = await getPrevalenceData();
    const studyId = params.get("studyId");
    const metricId = params.get("metricId");
    return data.records
      .filter((record) => (territoryId ? record.territoryId === territoryId : true))
      .filter((record) => (studyId ? record.studyId === studyId : true))
      .filter((record) => (metricId ? record.metricId === metricId : true))
      .filter((record) => inRange(record.measuredAt, from, to))
      .map(({ id, metricId, territoryId, valueNumeric, sampleSize, source, measuredAt }) => ({ id, metricId, territoryId, valueNumeric, sampleSize, source, measuredAt }));
  }
  if (type === "field_operations") {
    const data = await getOperationsData();
    const status = params.get("status");
    return data.fieldCommissions
      .filter((commission) => (territoryId ? commission.territoryId === territoryId : true))
      .filter((commission) => (status ? commission.status === status : true))
      .filter((commission) => inRange(commission.scheduledAt, from, to))
      .map(({ id, title, commissionType, assignedTo, territoryId, status, scheduledAt, checkIns }) => ({
        id, title, commissionType, assignedTo, territoryId, status, scheduledAt, checkIns: checkIns.length,
      }));
  }
  if (type === "ai_usage") {
    const data = await getAssistantData();
    return data.conversations
      .filter((conversation) => inRange(conversation.createdAt, from, to))
      .map(({ id, title, status, userId, promptTemplateId, createdAt, messages }) => ({
        id, title, status, userId, promptTemplateId, createdAt, mensajes: messages.length,
      }));
  }
  if (type === "territory_reach") {
    const [members, events, territories] = await Promise.all([listMembers(), listEvents(), getTerritories()]);
    return territories
      .filter((territory) => (territoryId ? territory.id === territoryId : true))
      .map((territory) => ({
        territoryId: territory.id,
        territorio: territory.name,
        tipo: territory.type,
        miembros: members.filter((member) => member.territoryId === territory.id).length,
        eventos: events.filter((event) => event.territoryId === territory.id).length,
        asistentes: events.filter((event) => event.territoryId === territory.id).reduce((sum, event) => sum + event.attendeesCount, 0),
      }));
  }
  const rows = await listMembers({
    q: params.get("q") ?? undefined,
    territoryId,
    status: params.get("status") ?? undefined,
    from: from ?? undefined,
    to: to ?? undefined,
  });
  return rows.map(({ id, memberNumber, fullName, status, joinedAt, territoryId }) => ({ id, memberNumber, fullName, status, joinedAt, territoryId }));
}
