"use client";

import { type FormEvent, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { updateMemberPhotoAction } from "@/server/actions/platform";

export function MemberPhotoUploader({ memberId, currentPhoto }: { memberId?: string; currentPhoto?: string }) {
  const [state, formAction, pending] = useActionState(updateMemberPhotoAction, null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | undefined>(currentPhoto);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Selecciona una imagen.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    setUploading(true);
    const uploadPayload = new FormData();
    uploadPayload.set("file", file);
    uploadPayload.set("entityType", "member-photo");
    const response = await fetch("/api/upload", { method: "POST", body: uploadPayload });
    setUploading(false);
    if (!response.ok) {
      setError("No se pudo subir la imagen.");
      return;
    }
    const result = (await response.json()) as { url: string };
    setPreview(result.url);
    const payload = new FormData();
    payload.set("photoUrl", result.url);
    if (memberId) payload.set("memberId", memberId);
    formAction(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-4">
      <div className="size-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Fotografia" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-slate-400">Sin foto</div>
        )}
      </div>
      <div className="space-y-2">
        <input name="file" type="file" accept="image/*" className="block text-sm" />
        <div className="flex items-center gap-2">
          <Button type="submit" className="h-9 px-3 text-xs" disabled={pending || uploading}>
            {uploading ? "Subiendo..." : pending ? "Guardando..." : "Guardar fotografia"}
          </Button>
          {error ? <span className="text-xs text-rose-700">{error}</span> : null}
          {state?.message ? <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span> : null}
        </div>
      </div>
    </form>
  );
}
