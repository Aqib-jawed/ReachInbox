import type { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  onClick?: () => void;
}

export function Card({
  children,
  className = "",
  title,
  subtitle,
  footer,
  onClick,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E5E7EB] text-[#1F2937] rounded-xl shadow-sm p-6 transition-all duration-200 ${
        onClick ? "cursor-pointer hover:border-[#10B981]/40 hover:shadow-md" : ""
      } ${className}`}
    >
      {(title || subtitle) && (
        <div className="mb-4 pb-3 border-b border-[#E5E7EB]">
          {title && <h3 className="text-base font-semibold text-[#1F2937] tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div>{children}</div>
      {footer && <div className="mt-4 pt-3 border-t border-[#E5E7EB]">{footer}</div>}
    </div>
  );
}
