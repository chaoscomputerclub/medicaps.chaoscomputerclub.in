import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[38px] w-full rounded-md border border-white/12 bg-black px-3.5 py-2 text-base text-white placeholder:text-zinc-600 transition-colors duration-150 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-white focus-visible:outline-none focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400 disabled:cursor-not-allowed disabled:opacity-50 md:text-xs",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
