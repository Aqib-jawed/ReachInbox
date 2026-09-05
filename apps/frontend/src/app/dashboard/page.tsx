import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import ScheduledTable from "@/components/ScheduledTable";
import SentTable from "@/components/SentTable";
import ComposeModal from "@/components/ComposeModal";
import { withAuth } from "@/middleware/withAuth";
import {
  Clock,
  Send,
  Search,
  Filter,
  RotateCw,
  ChevronDown,
  LogOut,
} from "lucide-react";

function DashboardPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">("scheduled");
  const [showCompose, setShowCompose] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleScheduled = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-white text-[#1F2937] flex flex-col md:flex-row antialiased font-sans">
      {/* LEFT SIDEBAR: Width ~230px, White background */}
      <aside className="w-full md:w-[230px] shrink-0 bg-white border-r border-[#F3F4F6] md:min-h-screen p-5 flex flex-col justify-between">
        <div>
          {/* Logo "ONB" at top left */}
          <div className="mb-4">
            <span className="text-[22px] font-black tracking-tight text-[#111111] font-mono select-none block leading-none">
              ONB
            </span>
          </div>

          {/* User Profile Card */}
          <div className="bg-[#F4F5F7] rounded-xl p-2.5 flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#D1FAE5] text-[#00A859] font-bold text-[11px] flex items-center justify-center shrink-0">
                OB
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[12.5px] font-semibold text-[#1F2937] truncate">
                  {user?.name || "Oliver Brown"}
                </p>
                <p className="text-[10.5px] text-[#9CA3AF] truncate">
                  oliver.brown@domain.io
                </p>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 ml-1" />
          </div>

          {/* Compose Button */}
          <button
            type="button"
            onClick={() => setShowCompose(true)}
            className="w-full py-1.5 px-4 rounded-full border border-[#00A859] text-[#00A859] hover:bg-[#EAF7EE] text-[13px] font-medium text-center transition-colors duration-150 cursor-pointer block mb-5"
          >
            Compose
          </button>

          {/* CORE section */}
          <div>
            <div className="text-[10px] font-bold text-[#A0AEC0] tracking-wider uppercase mb-1.5 px-1">
              CORE
            </div>

            <nav className="space-y-1">
              {/* Scheduled */}
              <button
                type="button"
                onClick={() => setActiveTab("scheduled")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] transition-colors duration-150 cursor-pointer ${
                  activeTab === "scheduled"
                    ? "bg-[#EAF7EE] text-[#1F2937] font-semibold"
                    : "text-[#6B7280] hover:bg-[#F4F5F7] font-normal"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#1F2937]" />
                  <span>Scheduled</span>
                </div>
                <span className="text-[12px] text-[#6B7280]">12</span>
              </button>

              {/* Sent */}
              <button
                type="button"
                onClick={() => setActiveTab("sent")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] transition-colors duration-150 cursor-pointer ${
                  activeTab === "sent"
                    ? "bg-[#EAF7EE] text-[#1F2937] font-semibold"
                    : "text-[#6B7280] hover:bg-[#F4F5F7] font-normal"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Send className="w-4 h-4 text-[#6B7280]" />
                  <span>Sent</span>
                </div>
                <span className="text-[12px] text-[#9CA3AF]">785</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-[#F3F4F6]">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11.5px] text-[#9CA3AF] hover:text-[#EF4444] transition-colors"
          >
            <LogOut className="w-3 h-3" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 bg-white flex flex-col min-w-0">
        {/* Search Bar + Filter + Refresh */}
        <div className="pt-4 pb-3 px-6 flex items-center gap-3">
          <div className="bg-[#F4F5F7] rounded-full px-4 py-2 flex items-center gap-2.5 w-full max-w-xl">
            <Search className="w-4 h-4 text-[#9CA3AF] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="bg-transparent text-[13px] text-[#1F2937] placeholder-[#9CA3AF] outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-2 text-[#9CA3AF] shrink-0 ml-1">
            <button
              type="button"
              className="p-1.5 hover:text-[#1F2937] transition-colors cursor-pointer"
              title="Filter"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-1.5 hover:text-[#1F2937] transition-colors cursor-pointer"
              title="Refresh"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-[#F4F5F6]" />

        {/* Email Rows List */}
        <div className="flex-1 overflow-y-auto px-2 sm:px-4">
          {activeTab === "scheduled" && (
            <ScheduledTable
              onOpenCompose={() => setShowCompose(true)}
              refreshKey={refreshKey}
            />
          )}
          {activeTab === "sent" && (
            <SentTable
              onOpenCompose={() => setShowCompose(true)}
              refreshKey={refreshKey}
            />
          )}
        </div>
      </main>

      <ComposeModal
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        onScheduled={handleScheduled}
        onSchedule={handleScheduled}
        userId={user?.id}
        senders={user?.senders || []}
      />
    </div>
  );
}

export default withAuth(DashboardPage);