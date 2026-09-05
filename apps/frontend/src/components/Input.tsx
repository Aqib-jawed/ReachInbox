import type { ChangeEvent, ReactNode } from "react";

export interface InputProps {
  label?: string;
  placeholder?: string;
  type?: string;
  value?: string | number;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  leftIcon?: ReactNode;
  helperText?: string;
  autoFocus?: boolean;
  required?: boolean;
}

export function Input({
  label,
  placeholder,
  type = "text",
  value = "",
  onChange,
  error,
  disabled = false,
  className = "",
  id,
  name,
  leftIcon,
  helperText,
  autoFocus,
  required,
}: InputProps) {
  const inputId = id || name;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="font-normal text-xs text-[#6B7280]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 text-[#6B7280] pointer-events-none flex items-center">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          autoFocus={autoFocus}
          required={required}
          className={`w-full px-3 py-2.5 border rounded-md focus:outline-none text-sm transition-all duration-150 ${
            leftIcon ? "pl-9" : ""
          } ${
            error
              ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444] bg-red-50/50 text-[#1F2937]"
              : "border-[#E5E7EB] bg-[#F3F4F6] text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]"
          } ${disabled ? "opacity-60 cursor-not-allowed bg-gray-200" : ""} ${className}`}
        />
      </div>
      {error && <span className="text-[#EF4444] text-xs mt-0.5">{error}</span>}
      {!error && helperText && <span className="text-[#6B7280] text-xs mt-0.5">{helperText}</span>}
    </div>
  );
}

export { Textarea } from "./Textarea";
