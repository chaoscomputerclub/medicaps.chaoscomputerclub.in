import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MakoMascot } from "@/components/common/MakoMascot";

export function NotFoundPage() {
  const navigate = useNavigate();

  const handleGoBack = () => {
    // Fall back to home when there's no in-app history (e.g. direct visit)
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <main
      className="min-h-[75vh] flex items-center justify-center px-6 py-16 animate-in fade-in duration-300"
      aria-labelledby="not-found-title"
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <MakoMascot variant="not-found" size="2xl" className="mb-4 drop-shadow-md select-none pointer-events-none" />

        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-sans font-medium text-zinc-400 bg-white/[0.05] border border-white/[0.08] mb-2 tracking-wide uppercase">
          404 Not Found
        </span>

        <h1
          id="not-found-title"
          className="mb-2 text-2xl sm:text-3xl font-sans font-bold tracking-tight text-white"
        >
          Page not found
        </h1>

        <p className="mb-8 text-sm leading-relaxed text-zinc-400 font-sans max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        <div className="flex w-full flex-col-reverse justify-center gap-3 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoBack}
            className="rounded-[10px] bg-[#171717] border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:text-white hover:border-white/20 font-heading font-bold uppercase tracking-wider text-xs"
          >
            <ArrowLeft className="size-3.5 mr-1.5 text-[#B1FA63]" aria-hidden="true" />
            <span>Go back</span>
          </Button>

          <Button
            asChild
            className="rounded-[10px] bg-[#B1FA63] text-black hover:bg-[#a0ee4e] font-heading font-extrabold uppercase tracking-wider text-xs"
          >
            <Link to="/">
              <Home className="size-3.5 mr-1.5" aria-hidden="true" />
              <span>Back to dashboard</span>
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}