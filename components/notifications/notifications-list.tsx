"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { markNotificationsReadAction } from "@/server/actions/notifications";
import type { NotificationRow } from "@/server/queries/notifications";

function MarkAll() {
  const [state, action, pending] = useActionState(markNotificationsReadAction, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <Button type="submit" variant="secondary" className="h-9 px-3 text-sm" disabled={pending}>
        {pending ? "..." : "Marcar todo como leido"}
      </Button>
      {state?.ok ? <span className="text-xs text-emerald-700">Listo</span> : null}
    </form>
  );
}

function Item({ n }: { n: NotificationRow }) {
  const [, action, pending] = useActionState(markNotificationsReadAction, null);
  const inner = (
    <div className={`rounded-lg border p-4 ${n.read ? "border-slate-200 bg-white" : "border-teal-200 bg-teal-50/60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{n.title}</p>
          {n.body ? <p className="mt-1 text-sm text-slate-600">{n.body}</p> : null}
          <p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString("es-MX")}</p>
        </div>
        {!n.read ? <span className="mt-1 inline-block size-2 shrink-0 rounded-full bg-teal-600" aria-label="sin leer" /> : null}
      </div>
      {!n.read ? (
        <form action={action} className="mt-2">
          <input type="hidden" name="id" value={n.id} />
          <button type="submit" disabled={pending} className="text-xs text-teal-700 underline">Marcar como leido</button>
        </form>
      ) : null}
    </div>
  );
  return n.href ? <Link href={n.href} className="block">{inner}</Link> : inner;
}

export function NotificationsList({ notifications }: { notifications: NotificationRow[] }) {
  const hasUnread = notifications.some((n) => !n.read);
  return (
    <div className="space-y-4">
      {hasUnread ? <MarkAll /> : null}
      <div className="space-y-3">
        {notifications.map((n) => <Item key={n.id} n={n} />)}
      </div>
    </div>
  );
}
