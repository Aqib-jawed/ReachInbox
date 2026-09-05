import type { ReactNode } from "react";

export interface EmptyAction {
  label: string;
  onClick: () => void;
}

export interface EmptyProps {
  icon?: ReactNode | string;
  title?: string;
  description?: string;
  message?: string;
  action?: EmptyAction;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function Empty({
  title = "Nothing here yet",
  description,
  message,
  action,
  actionLabel,
  onAction,
  icon,
  className = "",
}: EmptyProps) {
  const displayText = description || message || "No records available.";
  const resolvedAction =
    action || (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined);

  const renderIcon = () => {
    if (!icon) {
      return (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      );
    }
    if (typeof icon === "string") {
      if (icon === "clock") {
        return (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      }
      return <span className="text-xl">{icon}</span>;
    }
    return icon;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 ${className}`}
    >
      <div className="w-12 h-12 mb-3 flex items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
        {renderIcon()}
      </div>
      <h4 className="text-base font-semibold text-white tracking-tight">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">{displayText}</p>
      {resolvedAction && (
        <button
          type="button"
          onClick={resolvedAction.onClick}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all duration-150"
        >
          <span>{resolvedAction.label}</span>
        </button>
      )}
    </div>
  );
}

export const EmptyState = Empty;
