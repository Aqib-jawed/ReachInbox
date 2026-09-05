import { User } from "../types";

export interface HeaderProps {
  user?: User | null;
  onLogout: () => void;
  isSlackConnected?: boolean;
  onOpenCompose?: () => void;
  onOpenSlackModal?: () => void;
  className?: string;
}

export function Header({
  user,
  onLogout,
  isSlackConnected,
  onOpenCompose,
  onOpenSlackModal,
  className = "",
}: HeaderProps) {
  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return "U";
  };

  return (
    <header
      className={`border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 ${className}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-500/20">
            R
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none">
              ReachInbox
            </h1>
            <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">
              Email Scheduler
            </span>
          </div>
        </div>

        {/* Action Controls & User Profile */}
        <div className="flex items-center gap-3">
          {onOpenCompose && (
            <button
              type="button"
              onClick={onOpenCompose}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
            >
              <span>+ Compose Outbox</span>
            </button>
          )}

          {onOpenSlackModal && (
            <button
              type="button"
              onClick={onOpenSlackModal}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isSlackConnected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isSlackConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
                }`}
              />
              <span>{isSlackConnected ? "Slack Connected" : "Connect Slack"}</span>
            </button>
          )}

          {user && (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2.5">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || user.email}
                    className="w-8 h-8 rounded-full ring-2 ring-indigo-500/40 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-500/40">
                    {getInitials(user.name, user.email)}
                  </div>
                )}
                <div className="hidden md:block text-left leading-tight">
                  <p className="text-xs font-semibold text-white">{user.name || "User"}</p>
                  <p className="text-[11px] text-slate-400 truncate max-w-[140px]">{user.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-800 hover:bg-slate-800/60 transition-colors font-medium"
                title="Sign out of ReachInbox"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
