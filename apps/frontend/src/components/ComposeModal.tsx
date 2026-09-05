import { ComposeModal as FeatureComposeModal } from "../features/compose/ComposeModal";
import { apiClient } from "../services/api";
import toast from "react-hot-toast";

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled?: () => void;
  onSchedule?: (payload: any) => Promise<void> | void;
  userId?: string;
  senders?: Array<{ id: string; etherealEmail: string }>;
}

export function ComposeModal({
  isOpen,
  onClose,
  onScheduled,
  onSchedule,
  userId,
  senders = [],
}: ComposeModalProps) {
  const handleScheduleBatch = async (payload: any) => {
    try {
      if (onSchedule) {
        await onSchedule(payload);
      } else {
        await apiClient.schedule(payload);
      }
      toast.success("Emails successfully enqueued!");
      if (onScheduled) onScheduled();
    } catch (err: any) {
      toast.error(err?.message || "Failed to schedule batch");
      throw err;
    }
  };

  return (
    <FeatureComposeModal
      isOpen={isOpen}
      onClose={onClose}
      senders={senders as any}
      userId={userId || ""}
      onSchedule={handleScheduleBatch}
      onScheduled={onScheduled}
    />
  );
}

export default ComposeModal;