import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex w-full bg-white/[0.04] text-white text-[12px] px-2.5 py-1.5 rounded-md border border-white/[0.06] focus:outline-none focus:border-blue-500/50 placeholder-white/20 disabled:cursor-not-allowed disabled:opacity-40 input-premium",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
