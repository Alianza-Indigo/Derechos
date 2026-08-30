"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createCaseAction } from "@/server/actions/platform";

type Option = { value: string; label: string };

const GENDERS = ["No especificado", "Femenino", "Masculino", "Otro"];
const AGE_GROUPS = ["No especificado", "Ninez (0-11)", "Adolescencia (12-17)", "Adultez (18-59)", "Persona mayor (60+)"];
const CONSENT = ["documentado", "pendiente", "no_aplica"];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

const inputCls = "mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm";
const selectCls = inputCls;

export function CaseIntakeForm({
  territories,
  users,
  categories,
  priorities,
  statuses,
}: {
  territories: Option[];
  users: Option[];
  categories: readonly string[];
  priorities: readonly string[];
  statuses: readonly string[];
}) {
  const [state, action, pending] = useActionState(createCaseAction, null);
  return (
    <form action={action} className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-700">1. Datos del caso</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Titulo del caso"><input name="title" required minLength={5} placeholder="Resumen breve del caso" className={inputCls} /></Field>
          </div>
          <Field label="Categoria"><select name="category" className={selectCls}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Prioridad"><select name="priority" defaultValue="Media" className={selectCls}>{priorities.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Territorio"><select name="territoryId" className={selectCls}>{territories.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
          <Field label="Responsable asignado"><select name="assignedTo" className={selectCls}>{users.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</select></Field>
          <Field label="Estado inicial"><select name="status" className={selectCls}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-700">2. Hechos</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Fecha de los hechos"><input name="incidentDate" type="date" className={inputCls} /></Field>
          <Field label="Lugar de los hechos"><input name="incidentLocation" placeholder="Direccion, colonia, referencia" className={inputCls} /></Field>
          <div className="md:col-span-2">
            <Field label="Derecho vulnerado o tipo de violacion"><input name="rightViolated" placeholder="Ej. Acceso a la salud, debido proceso, no discriminacion" className={inputCls} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Descripcion de los hechos" hint="Que paso, cuando, donde y quienes participaron.">
              <textarea name="description" required minLength={20} className="mt-1 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </Field>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-700">3. Persona afectada</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre" hint="Escribe 'Reservado' si debe protegerse."><input name="victimName" required minLength={2} className={inputCls} /></Field>
          <Field label="Contacto"><input name="victimContact" placeholder="Telefono o correo (o 'Reservado')" className={inputCls} /></Field>
          <Field label="Genero"><select name="victimGender" className={selectCls}>{GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}</select></Field>
          <Field label="Grupo de edad"><select name="victimAgeGroup" className={selectCls}>{AGE_GROUPS.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
          <Field label="Consentimiento"><select name="consentStatus" className={selectCls}>{CONSENT.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-700">4. Quien reporta <span className="font-normal normal-case text-slate-400">(si es distinto de la persona afectada)</span></h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Nombre"><input name="reporterName" className={inputCls} /></Field>
          <Field label="Contacto"><input name="reporterContact" className={inputCls} /></Field>
          <Field label="Relacion con la persona afectada"><input name="reporterRelation" placeholder="Ej. Familiar, defensor, testigo" className={inputCls} /></Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-teal-700">5. Autoridad o institucion senalada <span className="font-normal normal-case text-slate-400">(opcional)</span></h3>
        <Field label="Nombre de la autoridad o institucion"><input name="authorityName" placeholder="Ej. Hospital General, Fiscalia, Ayuntamiento" className={inputCls} /></Field>
      </section>

      <div className="space-y-2 border-t border-slate-200 pt-4">
        {state?.message ? <p className="text-sm text-rose-700">{state.message}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? "Registrando..." : "Registrar caso"}</Button>
      </div>
    </form>
  );
}
