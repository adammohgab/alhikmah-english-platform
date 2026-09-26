import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-gold-500 text-navy-900 hover:bg-gold-600 border border-gold-600",
  secondary: "bg-surface-0 text-navy-900 border border-line-200 hover:bg-surface-100",
  ghost: "bg-transparent text-current hover:bg-surface-100 border border-transparent",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "h-11 px-5 text-[15px]",
  sm: "h-9 px-4 text-[13px]",
};

export function Button({ variant = "primary", size = "md", className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md font-sans font-semibold",
        "transition-colors duration-100 ease-out disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
