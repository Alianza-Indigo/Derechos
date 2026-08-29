import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { caseCategories, caseStatuses, priorities } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getTerritories, getTerritoryName, getUserName, getUsers, listCases } from "@/server/queries/app";

type Search = {
  q?: string;
  category?: string;
  status?: string;
  priority?: string;
  territoryId?: string;
  assignedTo?: string;
  from?: string;
  to?: string;
};

export default async function CasesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [records, territories, users] = await Promise.all([listCases(sp), getTerritories(), getUsers()]);

  return (
    <Card>
      <CardHeader title="Bandeja de casos" description="Expedientes con folio, prioridad, responsable, territorio y trazabilidad." action={<LinkButton href="/casos/nuevo">Nuevo caso</LinkButton>} />
      <form className="mb-4 grid gap-2 md:grid-cols-4">
        <input name="q" defaultValue={sp.q} placeholder="Buscar folio o titulo..." className="h-10 rounded-md border border-slate-300 px-3 text-sm md:col-span-2" />
        <select name="category" defaultValue={sp.category ?? ""} className="h-10 rounded-md border border-slate-300 px-2 text-sm">
          <option value="">Categoria: todas</option>
          {caseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-md border border-slate-300 px-2 text-sm">
          <option value="">Estado: todos</option>
          {caseStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="priority" defaultValue={sp.priority ?? ""} className="h-10 rounded-md border border-slate-300 px-2 text-sm">
          <option value="">Prioridad: todas</option>
          {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select name="territoryId" defaultValue={sp.territoryId ?? ""} className="h-10 rounded-md border border-slate-300 px-2 text-sm">
          <option value="">Territorio: todos</option>
          {territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select name="assignedTo" defaultValue={sp.assignedTo ?? ""} className="h-10 rounded-md border border-slate-300 px-2 text-sm">
          <option value="">Responsable: todos</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-600">Desde<input name="from" type="date" defaultValue={sp.from} className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm" /></label>
        <label className="flex items-center gap-1 text-xs text-slate-600">Hasta<input name="to" type="date" defaultValue={sp.to} className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm" /></label>
        <div className="flex gap-2 md:col-span-4">
          <button className="h-10 rounded-md bg-teal-700 px-4 text-sm font-medium text-white">Filtrar</button>
          <LinkButton href="/casos">Limpiar</LinkButton>
        </div>
      </form>
      <p className="mb-2 text-xs text-slate-500">{records.length} casos</p>
      <DataTable headers={["Folio", "Titulo", "Categoria", "Prioridad", "Estado", "Territorio", "Responsable", "Apertura"]}>
        {records.map((record) => (
          <tr key={record.id}>
            <td className="px-4 py-3 font-medium"><Link href={`/casos/${record.id}`}>{record.caseNumber}</Link></td>
            <td className="px-4 py-3">{record.title}</td>
            <td className="px-4 py-3">{record.category}</td>
            <td className="px-4 py-3"><Badge tone={record.priority === "Urgente" ? "red" : record.priority === "Alta" ? "amber" : "slate"}>{record.priority}</Badge></td>
            <td className="px-4 py-3">{record.status}</td>
            <td className="px-4 py-3">{getTerritoryName(record.territoryId)}</td>
            <td className="px-4 py-3">{getUserName(record.assignedTo)}</td>
            <td className="px-4 py-3">{formatDate(record.openedAt)}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
