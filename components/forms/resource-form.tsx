"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";

type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "date" | "datetime-local" | "textarea" | "select";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | number;
};

export function ResourceForm({
  fields,
  action,
  submitLabel,
}: {
  fields: Field[];
  action: (state: { ok: boolean; message: string } | null, formData: FormData) => Promise<{ ok: boolean; message: string; output?: string }>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const { register } = useForm();

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.name} className={field.type === "textarea" ? "md:col-span-2" : ""}>
            <span className="text-sm font-medium text-slate-700">{field.label}</span>
            {field.type === "textarea" ? (
              <textarea {...register(field.name, { required: field.required })} required={field.required} defaultValue={field.defaultValue} className="mt-1 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-700" />
            ) : field.type === "select" ? (
              <select {...register(field.name, { required: field.required })} required={field.required} defaultValue={field.defaultValue} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700">
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input {...register(field.name, { required: field.required })} type={field.type ?? "text"} required={field.required} defaultValue={field.defaultValue} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-700" />
            )}
          </label>
        ))}
      </div>
      {state?.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Guardando..." : submitLabel}</Button>
    </form>
  );
}
