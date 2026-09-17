import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";

import { api, errorMessage, unwrap } from "../api";
import { Button } from "./ui";

interface Attachment {
  key: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  downloadUrl: string;
}

interface EvidenceUploaderProps {
  responseId?: string;
  disabled?: boolean;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // keep in sync with the backend limit

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvidenceUploader({ responseId, disabled }: EvidenceUploaderProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  const query = useQuery({
    queryKey: ["evidence", responseId],
    enabled: Boolean(responseId),
    queryFn: async () =>
      unwrap<Attachment[]>(await api.get(`/evidence/responses/${responseId}`)),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { key, uploadUrl } = unwrap<{ key: string; uploadUrl: string }>(
        await api.post(`/evidence/responses/${responseId}/upload-url`, {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        }),
      );

      // Upload goes straight to object storage — not through the api
      // instance, since it needs no auth header and a different host.
      const putResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!putResponse.ok) {
        throw new Error("The file upload to storage failed. Please try again.");
      }

      await api.post(`/evidence/responses/${responseId}/confirm`, {
        key,
        filename: file.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence", responseId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) =>
      api.delete(`/evidence/responses/${responseId}/attachments/${encodeURIComponent(key)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence", responseId] });
    },
  });

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setUploadError("");
    setStorageUnavailable(false);

    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(`File is too large. Maximum size is ${formatSize(MAX_UPLOAD_BYTES)}.`);
      return;
    }

    uploadMutation.mutate(file, {
      onError: (err) => {
        const message = errorMessage(err, "Could not upload this file.");
        if (message.toLowerCase().includes("not configured")) {
          setStorageUnavailable(true);
        } else {
          setUploadError(message);
        }
      },
    });
  }

  if (!responseId) {
    return (
      <p className="mt-3 text-xs text-slate-600">
        Save your response to attach supporting evidence files.
      </p>
    );
  }

  const attachments = query.data ?? [];

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Paperclip size={13} />
          Evidence files {attachments.length > 0 && `(${attachments.length}/5)`}
        </p>

        {!disabled && attachments.length < 5 && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="ghost"
              className="!px-2 !py-1 text-xs"
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} />
              {uploadMutation.isPending ? "Uploading..." : "Attach file"}
            </Button>
          </>
        )}
      </div>

      {storageUnavailable && (
        <p className="mt-2 text-xs leading-5 text-amber-400">
          File evidence isn't available yet — object storage hasn't been configured for this
          environment. Text evidence above still works normally.
        </p>
      )}

      {uploadError && !storageUnavailable && (
        <p className="mt-2 text-xs text-red-400">{uploadError}</p>
      )}

      {attachments.length > 0 && (
        <ul className="mt-3 space-y-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink px-3 py-2"
            >
              <a
                href={attachment.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-2 text-xs text-slate-300 hover:text-white"
              >
                <FileText size={14} className="shrink-0 text-slate-600" />
                <span className="truncate">{attachment.filename}</span>
                <span className="shrink-0 text-slate-600">{formatSize(attachment.size)}</span>
              </a>

              {!disabled && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(attachment.key)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 text-slate-600 transition hover:text-red-400 disabled:opacity-50"
                  aria-label={`Remove ${attachment.filename}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}