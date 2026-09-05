import type { ReactNode, MouseEvent } from "react";

export interface ButtonProps {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  isLoading?: boolean;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  isLoading = false,
  children,
  onClick,
  className = "",
  type = "button",
  leftIcon,
  rightIcon,
}: ButtonProps) {
  const isButtonLoading = loading || isLoading;
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#10B981] focus:ring-offset-white";

  const variantClasses: Record<string, string> = {
    primary: "bg-[#10B981] hover:bg-[#059669] text-white shadow-sm disabled:bg-[#10B981]/50",
    secondary: "bg-[#F3F4F6] hover:bg-[#D1FAE5] text-[#1F2937] border border-[#E5E7EB]",
    danger: "bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-sm",
    ghost: "bg-transparent hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#1F2937]",
    outline: "bg-white hover:bg-[#F9FAFB] text-[#1F2937] border border-[#E5E7EB]",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2.5 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2.5",
  };

  const disabledClasses =
    disabled || isButtonLoading
      ? "opacity-50 cursor-not-allowed"
      : "cursor-pointer active:scale-[0.98]";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isButtonLoading}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${disabledClasses} ${className}`}
    >
      {isButtonLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading...</span>
        </span>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
