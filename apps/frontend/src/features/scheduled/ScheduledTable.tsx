import React, { useState } from "react";
import { ScheduledEmail } from "../../types";
import { Clock, XCircle, Loader2, CalendarClock, Plus, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";

interface ScheduledTableProps {
  emails: ScheduledEmail[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCompose: () => void;
  onSelectEmail?: (email: ScheduledEmail) => void;
  onToast?: (type: "success" | "error" | "info", title: string, message?: string) => void;
}

function formatDisplayTime(dateStr?: string | Date) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${weekday} ${time}`;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  isLoading,
  onRefresh,
  onOpenCompose,
  onSelectEmail,
  onToast,
}) => {
  const [cancellingIds, setCancellingIds] = useState<Record<string, boolean>>({});

  const handleCancel = async (e: React.MouseEvent, email: ScheduledEmail) => {
    e.stopPropagation();
    if (!email.id) return;

    setCancellingIds((prev) => ({ ...prev, [email.id]: true }));
    try {
      await api.cancelEmail(email.id);
      onToast?.("success", "Email Cancelled", `Email to ${email.recipientEmail} has been cancelled.`);
      onRefresh();
    } catch (err: any) {
      onToast?.("error", "Cancel failed", err.message || "Failed to cancel email");
    } finally {
      setCancellingIds((prev) => ({ ...prev, [email.id]: false }));
    }
  };

  if (isLoading && (!emails || emails.length === 0)) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#9CA3AF]">
        <div className="w-7 h-7 border-2 border-[#00A859] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px]">Loading scheduled queue...</span>
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <div className="py-16 text-center px-4 border border-dashed border-[#EDEDED] rounded-2xl bg-[#FAFAFA] my-6 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-full bg-[#EAF7EE] text-[#00A859] flex items-center justify-center mx-auto mb-3">
          <CalendarClock className="w-6 h-6" />
        </div>
        <h3 className="text-[15px] font-bold text-[#1F2937] mb-1">No scheduled emails</h3>
        <p className="text-[12.5px] text-[#9CA3AF] mb-5 max-w-xs mx-auto">
          You don't have any pending emails in the schedule. Compose a new batch to start queueing.
        </p>
        <button
          type="button"
          onClick={onOpenCompose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00A859] text-white hover:bg-[#008f4c] text-[13px] font-semibold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Compose Email</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Sub-header counter */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#FAFAFA] border-b border-[#F4F5F6] text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
        <span>Scheduled Emails ({emails.length})</span>
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1 text-[#00A859] hover:underline cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Rows */}
      {emails.map((email) => {
        const timeBadgeText = formatDisplayTime(email.scheduledAt);

        // Strip HTML if any
        const rawSnippet = (email.body || "No content")
          .replace(/<[^>]*>?/gm, "")
          .replace(/\n/g, " ")
          .trim();

        const formattedRecipient = email.recipientEmail.includes("@")
          ? email.recipientEmail.split("@")[0]
          : email.recipientEmail;

        const isCancelling = Boolean(cancellingIds[email.id]);

        return (
          <div
            key={email.id}
            onClick={() => onSelectEmail && onSelectEmail(email)}
            className="py-3 px-4 flex items-center justify-between border-b border-[#F4F5F6] hover:bg-[#FAFAFA] transition-colors duration-150 cursor-pointer text-[13px] group"
          >
            <div className="flex items-center min-w-0 flex-1 pr-3">
              {/* Column 1: To: Recipient */}
              <div className="w-40 sm:w-48 shrink-0 font-bold text-[#1F2937] truncate pr-2">
                To: {formattedRecipient}
              </div>

              {/* Column 2: Amber Time Badge with Clock icon */}
              <div className="shrink-0 mr-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
                  <Clock className="w-3 h-3 text-[#B45309]" />
                  <span>{timeBadgeText}</span>
                </span>
              </div>

              {/* Column 3: Subject & Body Snippet */}
              <div className="flex items-center min-w-0 truncate">
                <span className="font-semibold text-[#1F2937] shrink-0 mr-1.5">
                  {email.subject}
                </span>
                <span className="text-[#9CA3AF] truncate">
                  - {rawSnippet}
                </span>
              </div>
            </div>

            {/* Cancel Action Button on hover */}
            <div className="shrink-0 flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => handleCancel(e, email)}
                disabled={isCancelling}
                title="Cancel scheduled email"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-rose-50 rounded-lg text-[#9CA3AF] hover:text-rose-600 cursor-pointer flex items-center gap-1 text-[11px]"
              >
                {isCancelling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cancel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ScheduledTable;
