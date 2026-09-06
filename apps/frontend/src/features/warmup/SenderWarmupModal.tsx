import React, { useState, useEffect } from "react";
import { Sender, WarmupStatus } from "../../types";
import { api } from "../../lib/api";
import { Flame, X, CheckCircle2, TrendingUp, ShieldAlert, Loader2 } from "lucide-react";

interface SenderWarmupModalProps {
  isOpen: boolean;
  onClose: () => void;
  sender: Sender | null;
  onUpdate?: () => void;
  onToast?: (type: "success" | "error" | "info", title: string, message?: string) => void;
}

export const SenderWarmupModal: React.FC<SenderWarmupModalProps> = ({
  isOpen,
  onClose,
  sender,
  onUpdate,
  onToast,
}) => {
  const [warmupStatus, setWarmupStatus] = useState<WarmupStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && sender?.id) {
      loadStatus(sender.id);
    }
  }, [isOpen, sender?.id]);

  const loadStatus = async (senderId: string) => {
    setIsLoading(true);
    try {
      const res = await api.getWarmupStatus(senderId);
      setWarmupStatus(res.data);
    } catch (err: any) {
      console.error("Failed to load warmup status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleWarmup = async () => {
    if (!sender?.id) return;
    setIsToggling(true);
    try {
      if (warmupStatus?.enabled) {
        const res = await api.stopWarmup(sender.id);
        setWarmupStatus(res.data);
        onToast?.("info", "Warm-up Stopped", "Sender reverted to standard hourly limit ceiling.");
      } else {
        const res = await api.startWarmup(sender.id);
        setWarmupStatus(res.data);
        onToast?.("success", "Warm-up Started", "Sender hourly rate will ramp up automatically.");
      }
      onUpdate?.();
    } catch (err: any) {
      onToast?.("error", "Action Failed", err.message || "Could not update warm-up state");
    } finally {
      setIsToggling(false);
    }
  };

  if (!isOpen || !sender) return null;

  const isEnabled = warmupStatus?.enabled ?? false;
  const currentLimit = warmupStatus?.currentEffectiveLimit ?? sender.rateLimitConfig?.maxPerHour ?? 50;
  const ceiling = warmupStatus?.ceilingLimit ?? sender.rateLimitConfig?.maxPerHour ?? 50;
  const days = warmupStatus?.daysSinceStart ?? 0;
  const plan = warmupStatus?.plan ?? [
    { day: 1, hourlyLimit: 20 },
    { day: 3, hourlyLimit: 50 },
    { day: 7, hourlyLimit: 100 },
    { day: 14, hourlyLimit: 200 },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#EDEDED] overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F4F5F6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#1F2937]">IP & Sender Warm-up</h2>
              <p className="text-[11.5px] text-[#9CA3AF] truncate max-w-xs">{sender.etherealEmail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#1F2937] p-1.5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#9CA3AF]">
              <Loader2 className="w-6 h-6 animate-spin text-[#00A859]" />
              <span className="text-xs">Loading warm-up progression...</span>
            </div>
          ) : (
            <>
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  isEnabled
                    ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]"
                    : "bg-[#FAFAFA] border-[#EDEDED] text-[#6B7280]"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold">
                      {isEnabled ? "Warm-up Active" : "Warm-up Disabled"}
                    </span>
                    {isEnabled && (
                      <span className="text-[10.5px] px-2 py-0.2 rounded-full bg-[#DCFCE7] text-[#15803D] font-mono">
                        Day {days}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#4B5563] mt-0.5">
                    {isEnabled
                      ? `Currently capped at ${currentLimit}/hr (ramping to ${ceiling}/hr)`
                      : `Standard limit of ${ceiling}/hr is in effect`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleWarmup}
                  disabled={isToggling}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer disabled:opacity-60 ${
                    isEnabled
                      ? "bg-white border border-rose-300 text-rose-600 hover:bg-rose-50"
                      : "bg-[#00A859] text-white hover:bg-[#008f4c] shadow-xs"
                  }`}
                >
                  {isToggling ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isEnabled ? (
                    "Stop Warm-up"
                  ) : (
                    "Start Warm-up"
                  )}
                </button>
              </div>

              {/* Progress Stepper & Schedule */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-[#6B7280]">
                  <span className="font-semibold text-[#1F2937]">Warm-up Ramp Schedule</span>
                  <span className="font-mono text-[11px]">Ceiling: {ceiling}/hr</span>
                </div>

                <div className="bg-[#FAFBFB] rounded-xl border border-[#EDEDED] p-3 divide-y divide-[#F4F5F6]">
                  {plan.map((step, idx) => {
                    const isPassedOrCurrent = isEnabled && days >= step.day;
                    const isCurrent =
                      isEnabled &&
                      days >= step.day &&
                      (idx === plan.length - 1 || days < plan[idx + 1].day);

                    return (
                      <div
                        key={step.day}
                        className={`py-2.5 px-2 flex items-center justify-between text-xs ${
                          isCurrent
                            ? "bg-[#EAF7EE] rounded-lg font-semibold text-[#00A859]"
                            : isPassedOrCurrent
                            ? "text-[#1F2937]"
                            : "text-[#9CA3AF]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isCurrent ? (
                            <TrendingUp className="w-3.5 h-3.5 text-[#00A859]" />
                          ) : isPassedOrCurrent ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border border-[#D1D5DB] inline-block" />
                          )}
                          <span>Day {step.day}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">
                            {Math.min(step.hourlyLimit, ceiling)} emails/hr
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#00A859] text-white">
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Informational Footer */}
              <div className="flex items-start gap-2 text-[11.5px] text-[#6B7280] bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                <ShieldAlert className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                <p>
                  Gradually ramping sending volume protects domain reputation and prevents mailbox
                  providers from rate-limiting or flagging outbound messages as spam.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SenderWarmupModal;
