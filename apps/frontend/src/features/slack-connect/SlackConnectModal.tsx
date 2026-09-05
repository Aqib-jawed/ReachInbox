import React, { useState } from "react";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { Slack, CheckCircle2, ShieldAlert, AlertTriangle } from "lucide-react";

interface SlackConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  integrationDetails?: {
    teamName?: string | null;
    channel?: string | null;
    connectedAt?: string;
  } | null;
  onConnect: () => void;
  onDisconnect: () => Promise<void>;
}

export const SlackConnectModal: React.FC<SlackConnectModalProps> = ({
  isOpen,
  onClose,
  isConnected,
  integrationDetails,
  onConnect,
  onDisconnect,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onDisconnect();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to disconnect Slack integration");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Slack Notifications Integration"
      subtitle="Receive real-time alerts when hourly rate limit breaches occur"
      maxWidth="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isConnected ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Slack Workspace Connected</span>
            </div>
            <div className="text-xs text-slate-300 space-y-1 pl-7">
              <p>
                <strong className="text-white">Workspace:</strong>{" "}
                {integrationDetails?.teamName || "Connected Team"}
              </p>
              {integrationDetails?.channel && (
                <p>
                  <strong className="text-white">Channel:</strong> {integrationDetails.channel}
                </p>
              )}
              {integrationDetails?.connectedAt && (
                <p className="text-slate-400">
                  Connected on: {new Date(integrationDetails.connectedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2.5 text-slate-200 font-semibold text-sm">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
              <span>Automated Rate-Limit Notifications</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              When any sender exceeds their hourly sending quota, jobs are automatically deferred to the next window and a rich Slack alert is dispatched to notify your operations team.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            Close
          </Button>

          {isConnected ? (
            <Button
              variant="danger"
              size="sm"
              isLoading={isLoading}
              onClick={handleDisconnect}
            >
              Disconnect Slack
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Slack className="w-4 h-4" />}
              onClick={onConnect}
            >
              Connect with Slack
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
