import type { ReactNode } from "react";

export interface Column<T = any> {
  key: string;
  label: string;
  render?: (row: T, index: number) => ReactNode;
  className?: string;
}

export interface TableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  empty?: ReactNode | string;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: T) => void;
}

export function Table<T = any>({
  columns,
  data,
  loading = false,
  empty,
  emptyMessage,
  className = "",
  onRowClick,
}: TableProps<T>) {
  const emptyContent = empty || emptyMessage || "No records found.";
  return (
    <div
      className={`w-full overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-sm ${className}`}
    >
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950/70">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400 ${
                  col.className || ""
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-sm">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center">
                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                  <svg
                    className="animate-spin h-6 w-6 text-indigo-500"
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
                  <span className="text-xs font-medium">Loading records...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                {typeof emptyContent === "string" ? (
                  <p className="text-sm font-medium">{emptyContent}</p>
                ) : (
                  emptyContent
                )}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={(row as any).id || rowIndex}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition-colors hover:bg-slate-800/50 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3.5 px-4 text-slate-200 ${col.className || ""}`}
                  >
                    {col.render ? col.render(row, rowIndex) : (row as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
