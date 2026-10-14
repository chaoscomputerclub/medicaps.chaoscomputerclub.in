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
            className="h-10 rounded-lg border-white/10 bg-transparent px-4 text-sm font-sans text-zinc-300 hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-[#B1FA63]/60"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Go back
          </Button>

          <Button
            asChild
            className="h-10 rounded-lg bg-[#B1FA63] px-4 text-sm font-sans font-semibold text-black hover:bg-[#9fe350] focus-visible:ring-2 focus-visible:ring-[#B1FA63]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Link to="/">
              <Home className="size-4" aria-hidden="true" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}