import React from "react";
import { ArrowLeft, X, AlertCircle, FileText, Download, CheckCircle2 } from "lucide-react";

export interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: {
    id?: string;
    recipientEmail: string;
    subject: string;
    body: string;
    scheduledAt?: string | Date | null;
    sentAt?: string | Date | null;
    scheduledTime?: string;
    status?: string;
    sender?: { etherealEmail?: string };
    senderEmail?: string;
  } | null;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  email,
}) => {
  if (!isOpen || !email) return null;

  const displayTime = email.sentAt || email.scheduledAt || email.scheduledTime;
  const formattedDate = displayTime
    ? new Date(displayTime).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

  const senderEmail =
    email.sender?.etherealEmail || email.senderEmail || "oliver.brown@reachinbox.ai";

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-[#E5E7EB] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Back arrow + Subject Title (left) | Close X (right) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-[#1F2937] tracking-tight truncate max-w-lg">
              {email.subject || "Oliver, happy there!"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Email Card */}
        <div className="p-6 overflow-y-auto space-y-5 bg-[#F9FAFB]">
          {/* Main Email Content Card (White background, 24px padding, 8px radius, subtle shadow) */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB] space-y-4">
            {/* Headers: From / To / Date */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D1FAE5] text-[#10B981] font-semibold flex items-center justify-center text-sm shrink-0">
                  {email.recipientEmail.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#1F2937]">From:</span>
                    <span className="text-sm text-[#1F2937]">{senderEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium text-[#6B7280]">To:</span>
                    <span className="text-xs text-[#6B7280]">{email.recipientEmail}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-[#6B7280]">{formattedDate}</span>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      email.status === "SENT"
                        ? "bg-[#D1FAE5] text-[#10B981]"
                        : "bg-[#FEF3C7] text-[#92400E]"
                    }`}
                  >
                    {email.status === "SENT" ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        Delivered
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24]" />
                        Scheduled Outbox
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Yellow Alert Box with message */}
            <div className="bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] rounded-lg p-3.5 flex items-start gap-3 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Notice: </span>
                {email.status === "SENT"
                  ? "This email has been dispatched via verified Ethereal/SMTP mailbox with rate limiter checks passed."
                  : "This email is queued in the BullMQ Redis delayed queue. It will be dispatched automatically at its target timestamp."}
              </div>
            </div>

            {/* Email Body */}
            <div className="text-sm text-[#1F2937] leading-relaxed whitespace-pre-wrap pt-2 min-h-[120px]">
              {email.body || "No message body provided."}
            </div>

            {/* Images at bottom (2-column grid) */}
            <div className="pt-4 border-t border-[#E5E7EB]">
              <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
                Attached Media (2)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Image item 1 */}
                <div className="border border-[#E5E7EB] rounded-lg p-3 bg-[#F9FAFB] flex items-center justify-between hover:border-[#10B981]/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-[#D1FAE5] flex items-center justify-center text-[#10B981]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#1F2937] truncate max-w-[140px]">
                        product_brief_q4.png
                      </p>
                      <span className="text-[11px] text-[#6B7280]">1.4 MB • PNG Image</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded text-[#6B7280] hover:text-[#10B981] hover:bg-white transition-colors"
                    title="Download asset"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                {/* Image item 2 */}
                <div className="border border-[#E5E7EB] rounded-lg p-3 bg-[#F9FAFB] flex items-center justify-between hover:border-[#10B981]/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-[#D1FAE5] flex items-center justify-center text-[#10B981]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#1F2937] truncate max-w-[140px]">
                        metrics_summary.jpg
                      </p>
                      <span className="text-[11px] text-[#6B7280]">842 KB • JPG Image</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded text-[#6B7280] hover:text-[#10B981] hover:bg-white transition-colors"
                    title="Download asset"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-[#E5E7EB] bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#1F2937] rounded-md transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailPreviewModal;
