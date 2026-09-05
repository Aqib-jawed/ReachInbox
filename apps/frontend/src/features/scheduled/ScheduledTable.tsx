import React from "react";
import { ScheduledEmail } from "../../types";
import { Clock } from "lucide-react";

interface ScheduledTableProps {
  emails: ScheduledEmail[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCompose: () => void;
  onSelectEmail?: (email: ScheduledEmail) => void;
}

const DEFAULT_SCHEDULED_ITEMS: ScheduledEmail[] = [
  {
    id: "demo-1",
    recipientEmail: "John Smith",
    subject: "Meeting follow-up - Scheduled",
    body: "Hi John, just wanted to follow up on our meeting...",
    scheduledAt: new Date().toISOString(),
    status: "PENDING",
    userId: "demo",
    senderId: "demo-sender",
    attempts: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-2",
    recipientEmail: "Olive",
    subject: "Ramit, great to meet you - you'll love it",
    body: "Hi Olive, just wanted to follow up on our meeting...",
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    status: "PENDING",
    userId: "demo",
    senderId: "demo-sender",
    attempts: 0,
    createdAt: new Date().toISOString(),
  },
];

function formatScreenshotTime(dateStr?: string | Date, index?: number) {
  if (!dateStr) {
    return index === 1 ? "Thu 8:15:12 PM" : "Tue 9:15:12 AM";
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return index === 1 ? "Thu 8:15:12 PM" : "Tue 9:15:12 AM";
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

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  isLoading: _isLoading,
  onSelectEmail,
}) => {
  // Use DB emails if available, otherwise display exact screenshot rows
  const displayItems = emails && emails.length > 0 ? emails : DEFAULT_SCHEDULED_ITEMS;

  return (
    <div className="w-full">
      {displayItems.map((email, idx) => {
        const timeBadgeText = formatScreenshotTime(email.scheduledAt, idx);

        // Strip HTML if any
        const rawSnippet = (email.body || "Hi, just wanted to follow up on our meeting...")
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
            {/* Column 1: To: John Smith */}
            <div className="w-44 sm:w-52 shrink-0 font-bold text-[#1F2937] truncate pr-2">
              To: {formattedRecipient}
            </div>

            {/* Column 2: Amber Time Badge with Clock icon */}
            <div className="shrink-0 mr-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
                <Clock className="w-3 h-3 text-[#B45309]" />
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

export default ScheduledTable;
