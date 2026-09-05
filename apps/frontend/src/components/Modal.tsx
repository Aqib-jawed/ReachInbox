import React, { useEffect } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  subtitle?: string;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  maxWidth,
  subtitle,
  className = "",
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const effectiveSize = maxWidth || size;
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full ${
          sizeClasses[effectiveSize] || sizeClasses.md
        } bg-white border border-[#E5E7EB] text-[#1F2937] rounded-xl shadow-2xl overflow-hidden transition-all duration-200 transform scale-100 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[#E5E7EB]">
          <div>
            <h2 className="text-lg font-semibold text-[#1F2937] tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-[#6B7280] hover:text-[#1F2937] text-2xl leading-none p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex justify-end items-center gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
