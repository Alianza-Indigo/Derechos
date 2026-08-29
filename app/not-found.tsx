import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-950">No encontrado</h1>
        <p className="mt-2 text-sm text-slate-600">El recurso solicitado no existe o no tienes acceso a el.</p>
        <Link href="/dashboard" className="mt-5 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
          Volver al panel
        </Link>
      </div>
    </main>
  );
}
