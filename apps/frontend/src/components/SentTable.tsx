import { useEffect, useState, useCallback } from "react";
import { Email } from "@/types";
import { apiClient } from "@/services/api";
import { SentTable as FeatureSentTable } from "../features/sent/SentTable";
import { EmailPreviewModal } from "./EmailPreviewModal";

export interface SentTableProps {
  onOpenCompose?: () => void;
  refreshKey?: number;
}

export function SentTable({ onOpenCompose, refreshKey }: SentTableProps = {}) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);

  const fetchEmails = useCallback(async () => {
    try {
      const response = await apiClient.getSent();
      setEmails(response.data || []);
    } catch (error) {
      console.error("Failed to fetch sent emails", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 4000);
    return () => clearInterval(interval);
  }, [fetchEmails, refreshKey]);

  return (
    <>
      <FeatureSentTable
        emails={emails as any}
        isLoading={loading}
        onRefresh={fetchEmails}
        onOpenCompose={onOpenCompose || (() => {})}
        onSelectEmail={(e) => setSelectedEmail(e)}
      />

      <EmailPreviewModal
        isOpen={Boolean(selectedEmail)}
        onClose={() => setSelectedEmail(null)}
        email={selectedEmail}
      />
    </>
  );
}

export default SentTable;