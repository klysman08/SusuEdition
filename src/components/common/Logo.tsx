import { Link } from "react-router";

import { cn } from "@/lib/utils";

/** `compact`: só o símbolo (trilho de ícones do editor). */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label={compact ? "SusuEdition" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <img src="/logo.svg" alt="" className="size-8" width={32} height={32} />
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight">
          Susu<span className="text-primary">Edition</span>
        </span>
      )}
    </Link>
  );
}
