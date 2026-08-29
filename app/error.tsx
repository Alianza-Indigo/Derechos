"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-950">Ocurrio un error</h1>
        <p className="mt-2 text-sm text-slate-600">
          No fue posible completar la operacion. Si el problema persiste, revisa la conexion a la base de datos y la configuracion del entorno.
        </p>
        <div className="mt-5">
          <Button type="button" onClick={reset}>Reintentar</Button>
        </div>
      </div>
    </main>
  );
}
