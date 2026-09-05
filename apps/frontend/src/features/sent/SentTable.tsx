import React from "react";
import { ScheduledEmail } from "../../types";
import { Clock } from "lucide-react";

interface SentTableProps {
  emails: ScheduledEmail[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCompose: () => void;
  onSelectEmail?: (email: ScheduledEmail) => void;
}

const DEFAULT_SENT_ITEMS: ScheduledEmail[] = [
  {
    id: "sent-1",
    recipientEmail: "Sarah Connor",
    subject: "Project milestone recap - Sent",
    body: "Hi Sarah, thank you for attending the sync earlier today...",
    scheduledAt: new Date(Date.now() - 3600000).toISOString(),
    sentAt: new Date(Date.now() - 3600000).toISOString(),
    status: "SENT",
    userId: "demo",
    senderId: "demo-sender",
    attempts: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "sent-2",
    recipientEmail: "Alex Morgan",
    subject: "Contract finalized & signed - Sent",
    body: "Hi Alex, please find the signed documentation attached...",
    scheduledAt: new Date(Date.now() - 7200000).toISOString(),
    sentAt: new Date(Date.now() - 7200000).toISOString(),
    status: "SENT",
    userId: "demo",
    senderId: "demo-sender",
    attempts: 1,
    createdAt: new Date().toISOString(),
  },
];

function formatScreenshotTime(dateStr?: string | Date, index?: number) {
  if (!dateStr) {
    return index === 1 ? "Mon 11:20:45 AM" : "Mon 02:40:10 PM";
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return index === 1 ? "Mon 11:20:45 AM" : "Mon 02:40:10 PM";
  }
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${weekday} ${time}`;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  isLoading: _isLoading,
  onSelectEmail,
}) => {
  const displayItems = emails && emails.length > 0 ? emails : DEFAULT_SENT_ITEMS;

  return (
    <div className="w-full">
      {displayItems.map((email, idx) => {
        const timeBadgeText = formatScreenshotTime(email.sentAt || email.scheduledAt, idx);

        const rawSnippet = (email.body || "Hi, please review the dispatched communication...")
          .replace(/<[^>]*>?/gm, "")
          .replace(/\n/g, " ")
          .trim();

        const formattedRecipient = email.recipientEmail.includes("@")
          ? email.recipientEmail.split("@")[0]
          : email.recipientEmail;

        return (
          <div
            key={email.id || idx}
            onClick={() => onSelectEmail && onSelectEmail(email)}
            className="py-3 px-4 flex items-center border-b border-[#F4F5F6] hover:bg-[#FAFAFA] transition-colors duration-150 cursor-pointer text-[13px] group"
          >
            {/* Column 1: To: Recipient */}
            <div className="w-44 sm:w-52 shrink-0 font-bold text-[#1F2937] truncate pr-2">
              To: {formattedRecipient}
            </div>

            {/* Column 2: Gray Time Badge with Clock icon */}
            <div className="shrink-0 mr-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]">
                <Clock className="w-3 h-3 text-[#4B5563]" />
                <span>{timeBadgeText}</span>
              </span>
            </div>

            {/* Column 3: Subject & Body Snippet in one line */}
            <div className="flex items-center min-w-0 truncate">
              <span className="font-semibold text-[#1F2937] shrink-0 mr-1.5">
                {email.subject}
              </span>
              <span className="text-[#9CA3AF] truncate">
                - {rawSnippet}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SentTable;
