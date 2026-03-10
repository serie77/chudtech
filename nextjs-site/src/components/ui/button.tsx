import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium btn-lift focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-500",
        secondary:
          "bg-white/[0.06] text-white/70 hover:bg-white/[0.1] border border-white/[0.06] hover:text-white/90",
        ghost: "text-white/40 hover:text-white/80 hover:bg-white/[0.06]",
        destructive: "text-white/30 hover:text-red-400 hover:bg-red-500/10",
        outline:
          "border border-white/[0.08] bg-transparent text-white/50 hover:bg-white/[0.06] hover:text-white/80",
      },
      size: {
        default: "h-7 px-3 text-[11px]",
        sm: "h-6 px-2 text-[11px]",
        lg: "h-8 px-4 text-xs",
        icon: "h-6 w-6 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
