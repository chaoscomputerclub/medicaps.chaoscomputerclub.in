import React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  body: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({ title, body, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center border border-white/8 rounded-none bg-black",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 text-zinc-600 font-mono text-2xl">{icon}</div>
      ) : (
        <div className="mb-4 text-2xl text-zinc-600 font-mono">∅</div>
      )}
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs text-zinc-500 max-w-md mt-1">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { EmptyState };