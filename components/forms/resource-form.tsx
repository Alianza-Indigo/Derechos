"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

type Field = {
  name: string;
  label?: string;
  type?: "text" | "email" | "number" | "date" | "datetime-local" | "textarea" | "select" | "hidden" | "checkbox";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | number;
  defaultChecked?: boolean;
  step?: string;
};

type State = { ok: boolean; message: string; output?: string } | null;

export function ResourceForm({
  fields,
  action,
  submitLabel,
}: {
  fields: Field[];
  action: (state: State, formData: FormData) => Promise<{ ok: boolean; message: string; output?: string }>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const hiddenFields = fields.filter((field) => field.type === "hidden");
  const visibleFields = fields.filter((field) => field.type !== "hidden");

  return (
    <form action={formAction} className="space-y-5">
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} defaultValue={field.defaultValue} />
      ))}
      <div className="grid gap-4 md:grid-cols-2">
        {visibleFields.map((field) => (
          <label key={field.name} className={field.type === "textarea" ? "md:col-span-2" : ""}>
            <span className="text-sm font-medium text-slate-700">{field.label}</span>
            {field.type === "textarea" ? (
              <textarea name={field.name} required={field.required} defaultValue={field.defaultValue} className="mt-1 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-700" />
            ) : field.type === "select" ? (
              <select name={field.name} required={field.required} defaultValue={field.defaultValue} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700">
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "checkbox" ? (
              <span className="mt-2 flex items-center gap-2">
                <input name={field.name} type="checkbox" defaultChecked={field.defaultChecked} value="true" className="size-4 rounded border-slate-300" />
                <span className="text-sm text-slate-600">Activado</span>
              </span>
            ) : (
              <input name={field.name} type={field.type ?? "text"} step={field.step} required={field.required} defaultValue={field.defaultValue} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700" />
            )}
          </label>
        ))}
      </div>
      {state?.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Guardando..." : submitLabel}</Button>
    </form>
  );
}
