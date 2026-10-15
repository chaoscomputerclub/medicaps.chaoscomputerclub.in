import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-[10px] border border-white/10 bg-[#171717] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 font-sans focus-visible:outline-none focus-visible:border-[#B1FA63] focus-visible:ring-1 focus-visible:ring-[#B1FA63] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 ease-linear",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
