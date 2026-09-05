export interface LoadingProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

export function Loading({ size = "md", text, fullScreen = false, className = "" }: LoadingProps) {
  const sizeClasses = {
    sm: "w-5 h-5 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };

  const textClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const containerClasses = fullScreen
    ? `fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-sm ${className}`
    : `flex flex-col items-center justify-center gap-3 p-6 ${className}`;

  return (
    <div className={containerClasses}>
      <div
        className={`${sizeClasses[size] || sizeClasses.md} border-indigo-500 border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label="loading"
      />
      {text && (
        <p className={`text-slate-400 font-medium ${textClasses[size] || textClasses.md}`}>
          {text}
        </p>
      )}
    </div>
  );
}
