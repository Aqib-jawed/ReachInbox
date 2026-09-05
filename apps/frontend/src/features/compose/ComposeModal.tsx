import React, { useState, useRef } from "react";
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Upload,
  ChevronDown,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Link2,
  X,
} from "lucide-react";
import { Sender } from "../../types";

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders?: Sender[] | Array<{ id: string; etherealEmail: string }>;
  userId?: string;
  onSchedule: (payload: any) => Promise<void>;
  onScheduled?: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  senders = [],
  userId,
  onSchedule,
  onScheduled,
}) => {
  const senderEmail = senders[0]?.etherealEmail || "oliver.brown@domain.io";
  const [recipientInput, setRecipientInput] = useState<string>("");
  const [recipientsList, setRecipientsList] = useState<string[]>([]);
  const [subject, setSubject] = useState<string>("");
  const [delayBetween, setDelayBetween] = useState<string>("00");
  const [hourlyLimit, setHourlyLimit] = useState<string>("00");
  const [body, setBody] = useState<string>("");

  // "Send Later" Popover State (Screenshot 001824.png)
  const [showSendLater, setShowSendLater] = useState<boolean>(false);
  const [selectedScheduledSlot, setSelectedScheduledSlot] = useState<string>("Tomorrow, 10:00 AM");
  const [customDateTime, setCustomDateTime] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  // Add email from input on Enter or comma
  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = recipientInput.trim().replace(/,/g, "");
      if (val && !recipientsList.includes(val)) {
        setRecipientsList((prev) => [...prev, val]);
        setRecipientInput("");
      }
    }
  };

  const removeRecipient = (emailToRemove: string) => {
    setRecipientsList((prev) => prev.filter((e) => e !== emailToRemove));
  };

  // CSV or List file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (matches && matches.length > 0) {
        const unique = Array.from(new Set(matches));
        setRecipientsList((prev) => Array.from(new Set([...prev, ...unique])));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Rich text helpers
  const applyFormatting = (prefix: string, suffix: string = prefix) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const currentText = body;
    const selected = currentText.substring(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;
    const nextBody =
      currentText.substring(0, start) + replacement + currentText.substring(end);
    setBody(nextBody);
  };

  const handleSend = async () => {
    setError(null);
    let finalRecipients = [...recipientsList];
    if (recipientInput.trim()) {
      finalRecipients.push(recipientInput.trim());
    }

    if (finalRecipients.length === 0) {
      finalRecipients = ["recipient@example.com"];
    }

    setIsLoading(true);
    try {
      const sender = senders.find((s) => s.etherealEmail === senderEmail) || senders[0];
      const delayMs = parseInt(delayBetween, 10) > 0 ? parseInt(delayBetween, 10) * 1000 : 2000;
      const limit = parseInt(hourlyLimit, 10) > 0 ? parseInt(hourlyLimit, 10) : 50;

      await onSchedule({
        userId: userId || undefined,
        senderId: sender?.id || undefined,
        senderEmail: senderEmail,
        recipients: finalRecipients,
        recipientEmail: finalRecipients.join(", "),
        subject: subject || "(No subject)",
        body: body || "Hi, please see the attached update.",
        startTime: customDateTime ? new Date(customDateTime).toISOString() : new Date(Date.now() + 60000).toISOString(),
        delayBetweenMs: delayMs,
        hourlyLimit: limit,
      });

      if (onScheduled) onScheduled();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to schedule email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 z-50 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-[#EDEDED] overflow-hidden flex flex-col relative my-auto min-h-[580px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: ← Compose New Email (left) | 📎 🕒 [Send Later] (right) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F4F5F6] bg-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-[#1F2937] hover:text-black transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-[15px] font-semibold text-[#1F2937] tracking-tight">
              Compose New Email
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Paperclip Icon */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[#00A859] hover:text-[#008f4c] p-1 transition-colors cursor-pointer"
              title="Attach File"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Clock Icon: Opens "Send Later" popover */}
            <button
              type="button"
              onClick={() => setShowSendLater(!showSendLater)}
              className="text-[#00A859] hover:text-[#008f4c] p-1 transition-colors cursor-pointer"
              title="Send Later"
            >
              <Clock className="w-4 h-4" />
            </button>

            {/* Send Later pill button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading}
              className="py-1 px-4 rounded-full border border-[#00A859] text-[#00A859] hover:bg-[#EAF7EE] text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-60"
            >
              {isLoading ? "Sending..." : "Send Later"}
            </button>
          </div>
        </div>

        {/* Floating "Send Later" Popover (Screenshot 001824.png) */}
        {showSendLater && (
          <div className="absolute right-6 top-14 z-30 w-72 bg-white rounded-xl shadow-xl border border-[#EDEDED] p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="text-[13px] font-semibold text-[#1F2937]">Send Later</div>

            {/* Pick date & time input */}
            <div className="relative">
              <input
                type="datetime-local"
                value={customDateTime}
                onChange={(e) => setCustomDateTime(e.target.value)}
                className="w-full text-xs text-[#1F2937] bg-white border border-[#E5E7EB] rounded-lg p-2 outline-none focus:border-[#00A859]"
                placeholder="Pick date & time"
              />
            </div>

            {/* Preset slots */}
            <div className="space-y-1 text-xs text-[#4B5563]">
              {["Tomorrow", "Tomorrow, 10:00 AM", "Tomorrow, 11:30 AM", "Tomorrow, 3:00 PM"].map(
                (slot) => (
                  <div
                    key={slot}
                    onClick={() => setSelectedScheduledSlot(slot)}
                    className={`p-1.5 rounded-md cursor-pointer hover:bg-[#F4F5F7] transition-colors ${
                      selectedScheduledSlot === slot ? "bg-[#EAF7EE] text-[#00A859] font-medium" : ""
                    }`}
                  >
                    {slot}
                  </div>
                )
              )}
            </div>

            {/* Popover actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F4F5F6]">
              <button
                type="button"
                onClick={() => setShowSendLater(false)}
                className="text-xs text-[#6B7280] hover:text-[#1F2937] px-2 py-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowSendLater(false)}
                className="py-1 px-3 rounded-full border border-[#00A859] text-[#00A859] hover:bg-[#EAF7EE] text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-[#EF4444] text-xs">
            {error}
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-3.5">
            {/* From Row */}
            <div className="flex items-center text-xs">
              <span className="w-14 text-[#6B7280] shrink-0">From</span>
              <div className="bg-[#F4F5F7] rounded-lg px-3 py-1 text-[12.5px] text-[#1F2937] inline-flex items-center gap-2 font-medium">
                <span>{senderEmail}</span>
                <ChevronDown className="w-3 h-3 text-[#9CA3AF]" />
              </div>
            </div>

            {/* To Row with "Upload List" button on right */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center flex-1 min-w-0 mr-3">
                <span className="w-14 text-[#6B7280] shrink-0">To</span>
                {/* Recipients Chips or Input (Screenshot 001848.png vs 001834.png) */}
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  {recipientsList.length > 0 ? (
                    <>
                      {recipientsList.slice(0, 3).map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 bg-[#EAF7EE] border border-[#A7E3B8] text-[#00A859] text-[11.5px] font-medium px-2.5 py-0.5 rounded-full"
                        >
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => removeRecipient(email)}
                            className="hover:text-red-500 transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      {recipientsList.length > 3 && (
                        <span className="bg-[#EAF7EE] border border-[#A7E3B8] text-[#00A859] text-[11px] font-medium px-2 py-0.5 rounded-full">
                          +{recipientsList.length - 3}
                        </span>
                      )}
                      <input
                        type="text"
                        value={recipientInput}
                        onChange={(e) => setRecipientInput(e.target.value)}
                        onKeyDown={handleRecipientKeyDown}
                        placeholder="Add more..."
                        className="bg-transparent text-[12.5px] text-[#1F2937] placeholder-[#9CA3AF] outline-none min-w-[100px] flex-1"
                      />
                    </>
                  ) : (
                    <input
                      type="text"
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      onKeyDown={handleRecipientKeyDown}
                      placeholder="recipient@example.com"
                      className="w-full bg-transparent text-[12.5px] text-[#1F2937] placeholder-[#9CA3AF] outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Upload List Button */}
              <label className="inline-flex items-center gap-1.5 text-[#00A859] hover:text-[#008f4c] text-[12px] font-medium cursor-pointer shrink-0 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload List</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Subject Row */}
            <div className="flex items-center text-xs">
              <span className="w-14 text-[#6B7280] shrink-0">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="w-full bg-transparent text-[12.5px] text-[#1F2937] placeholder-[#9CA3AF] outline-none"
              />
            </div>

            {/* Delay & Hourly Limit Row (Screenshot 001824.png / 001834.png) */}
            <div className="flex items-center gap-6 text-xs pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[#6B7280]">Delay between 2 emails</span>
                <input
                  type="text"
                  value={delayBetween}
                  onChange={(e) => setDelayBetween(e.target.value)}
                  className="w-12 h-7 bg-[#F4F5F7] rounded-lg text-center text-xs text-[#1F2937] font-medium outline-none border border-transparent focus:border-[#00A859]"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[#6B7280]">Hourly Limit</span>
                <input
                  type="text"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(e.target.value)}
                  className="w-12 h-7 bg-[#F4F5F7] rounded-lg text-center text-xs text-[#1F2937] font-medium outline-none border border-transparent focus:border-[#00A859]"
                />
              </div>
            </div>

            {/* Body Editor Container with Toolbar */}
            <div className="bg-[#FAFBFB] border border-[#EDEDED] rounded-2xl p-4 flex flex-col min-h-[260px] focus-within:border-[#00A859] transition-all">
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type Your Reply..."
                className="w-full flex-1 bg-transparent text-[13px] text-[#1F2937] placeholder-[#A0AEC0] outline-none resize-none min-h-[160px]"
              />

              {/* Formatting Toolbar at bottom of editor (Screenshot 001824.png) */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#EDEDED] text-[#6B7280] text-xs select-none">
                <button
                  type="button"
                  onClick={() => applyFormatting("", "")}
                  className="hover:text-black p-1"
                  title="Undo"
                >
                  <Undo className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("", "")}
                  className="hover:text-black p-1"
                  title="Redo"
                >
                  <Redo className="w-3.5 h-3.5" />
                </button>
                <span className="w-[1px] h-3.5 bg-[#E5E7EB]" />
                <button
                  type="button"
                  onClick={() => applyFormatting("<font size='4'>", "</font>")}
                  className="hover:text-black p-1 font-semibold text-[11px] flex items-center"
                  title="Font Size"
                >
                  <span>Tt</span>
                  <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("<b>", "</b>")}
                  className="hover:text-black p-1 font-bold text-xs"
                  title="Bold"
                >
                  <Bold className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("<i>", "</i>")}
                  className="hover:text-black p-1 italic text-xs"
                  title="Italic"
                >
                  <Italic className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("<u>", "</u>")}
                  className="hover:text-black p-1 underline text-xs"
                  title="Underline"
                >
                  <Underline className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("<s>", "</s>")}
                  className="hover:text-black p-1 line-through text-xs"
                  title="Strikethrough"
                >
                  <Strikethrough className="w-3 h-3" />
                </button>
                <span className="w-[1px] h-3.5 bg-[#E5E7EB]" />
                <button
                  type="button"
                  onClick={() => applyFormatting("<ul><li>", "</li></ul>")}
                  className="hover:text-black p-1"
                  title="Bullet list"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("<ol><li>", "</li></ol>")}
                  className="hover:text-black p-1"
                  title="Numbered list"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('<div align="left">', "</div>")}
                  className="hover:text-black p-1"
                  title="Align left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('<div align="center">', "</div>")}
                  className="hover:text-black p-1"
                  title="Align center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('<div align="right">', "</div>")}
                  className="hover:text-black p-1"
                  title="Align right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("<blockquote>", "</blockquote>")}
                  className="hover:text-black p-1"
                  title="Quote"
                >
                  <Quote className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('<a href="">', "</a>")}
                  className="hover:text-black p-1"
                  title="Link"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendLater(true)}
                  className="hover:text-black p-1"
                  title="Schedule"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Attached Media Thumbnail at bottom (Screenshot 001834.png / 001848.png) */}
          <div className="pt-2">
            <div className="relative w-24 h-16 rounded-xl overflow-hidden border border-[#EDEDED] shadow-2xs group">
              {/* Tennis Player Sample Image */}
              <img
                src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=200&auto=format&fit=crop&q=80"
                alt="Attachment preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[10px] text-white font-medium">Tennis.jpg</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeModal;
