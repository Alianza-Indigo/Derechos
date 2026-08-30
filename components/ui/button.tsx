import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const variants = {
  // El primario usa el color de marca del inquilino (--brand) si esta definido
  // en un ancestro; si no, cae al teal por defecto.
  primary: "bg-[var(--brand,#0f766e)] text-white hover:brightness-95",
  secondary: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-700 text-white hover:bg-rose-800",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={cn("inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition", variants[variant], className)} {...props} />;
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  variant?: keyof typeof variants;
};

export function LinkButton({ className, variant = "primary", href, children, ...props }: LinkButtonProps) {
  return (
    <Link href={href} className={cn("inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition", variants[variant], className)} {...props}>
      {children}
    </Link>
  );
}
