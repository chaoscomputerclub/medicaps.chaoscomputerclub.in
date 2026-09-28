import React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-none bg-zinc-900 border border-white/8", className)}
      {...props}
    />
  );
}

function SkeletonText({ className, lines = 1, ...props }: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded-none bg-zinc-900 border border-white/8" />
      ))}
    </div>
  );
}

function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("p-6 animate-pulse rounded-none bg-black border border-white/8 space-y-4", className)}
      {...props}
    >
      <div className="h-6 w-1/3 animate-pulse rounded-none bg-zinc-900 border border-white/8" />
      <div className="h-4 w-full animate-pulse rounded-none bg-zinc-900 border border-white/8" />
      <div className="h-4 w-2/3 animate-pulse rounded-none bg-zinc-900 border border-white/8" />
    </div>
  );
}

function SkeletonRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-4 animate-pulse rounded-none bg-black border border-white/8 p-4", className)}
      {...props}
    >
      <div className="size-10 rounded-full animate-pulse bg-zinc-900 border border-white/8" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/4 animate-pulse rounded-none bg-zinc-900 border border-white/8" />
        <div className="h-3 w-1/3 animate-pulse rounded-none bg-zinc-900 border border-white/8" />
      </div>
    </div>
  );
}

function SkeletonAvatar({ className, size = 10, ...props }: React.HTMLAttributes<HTMLDivElement> & { size?: number }) {
  return (
    <div
      className={cn(`size-${size} rounded-full animate-pulse bg-zinc-900 border border-white/8`, className)}
      {...props}
    />
  );
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonRow, SkeletonAvatar };