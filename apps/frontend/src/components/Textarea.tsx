import type { ChangeEvent } from "react";

export interface TextareaProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  helperText?: string;
}

export function Textarea({
  label,
  placeholder,
  value = "",
  onChange,
  error,
  rows = 4,
  disabled = false,
  className = "",
  id,
  name,
  helperText,
}: TextareaProps) {
  const textareaId = id || name;

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={textareaId} className="font-normal text-xs text-[#6B7280]">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        rows={rows}
        disabled={disabled}
        className={`w-full px-3 py-2.5 border rounded-md focus:outline-none text-sm transition-all duration-150 ${
          error
            ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-1 focus:ring-[#EF4444] bg-red-50/50 text-[#1F2937]"
            : "border-[#E5E7EB] bg-[#F3F4F6] text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-gray-200" : ""} ${className}`}
      />
      {error && <span className="text-[#EF4444] text-xs mt-0.5">{error}</span>}
      {!error && helperText && <span className="text-[#6B7280] text-xs mt-0.5">{helperText}</span>}
    </div>
  );
}
