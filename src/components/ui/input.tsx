import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[40px] w-full rounded-[10px] border border-white/10 bg-[#171717] px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 font-sans transition-all duration-200 ease-linear file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-white focus-visible:outline-none focus-visible:border-[#B1FA63] focus-visible:ring-1 focus-visible:ring-[#B1FA63] disabled:cursor-not-allowed disabled:opacity-50",
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
