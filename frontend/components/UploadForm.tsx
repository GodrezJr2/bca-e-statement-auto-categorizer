"use client";
import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { SurfaceCard } from "@/components/apple-ui";

interface UploadFormProps { onSuccess: () => void; }

export function UploadForm({ onSuccess }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") setFile(f);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus("uploading");
    setMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus("error"); setMessage("Not authenticated."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setStatus("error"); setMessage("Session expired."); return; }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) { setStatus("error"); setMessage("API URL not configured."); return; }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    let res: Response;
    try {
      res = await fetch(`${apiUrl}/api/upload-statement`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeout);
      setStatus("error");
      setMessage(err instanceof Error && err.name === "AbortError"
        ? "Request timed out. The server may be overloaded — try again."
        : "Could not reach the server. Check your connection.");
      return;
    }
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed." }));
      setStatus("error");
      setMessage(err.detail ?? "Upload failed.");
      return;
    }

    const data = await res.json();
    setStatus("done");
    setMessage(`${data.inserted} transactions imported`);
    setFile(null);
    setPassword("");
    onSuccess();
  }

  return (
    <SurfaceCard title="upload.statement" sub="PDF parser">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="relative flex cursor-pointer flex-col items-center justify-center border border-dashed px-4 py-7 text-center transition"
          style={{
            borderColor: dragging ? "var(--term-accent)" : "var(--term-border)",
            background: dragging ? "rgba(198,247,81,0.08)" : "var(--term-bg)",
          }}
        >
          <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <div className="flex items-center gap-2 font-mono text-xs">
              <FileText size={18} className="text-[var(--term-accent)]" />
              <span className="max-w-48 truncate text-[var(--term-fg)]">{file.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="border border-[var(--term-border)] p-1 text-[var(--term-muted)] hover:text-[var(--term-neg)]">
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={23} className="mb-2 text-[var(--term-muted)]" />
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[var(--term-secondary)]">Drop e-Statement PDF</p>
              <p className="mt-1 font-mono text-[10px] text-[var(--term-muted)]">or click to browse</p>
            </>
          )}
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Statement password (optional)"
          className="w-full border border-[var(--term-border)] bg-[var(--term-bg)] px-3 py-2 font-mono text-xs text-[var(--term-fg)] outline-none transition placeholder:text-[var(--term-muted)] focus:border-[var(--term-accent)]"
        />

        {message && (
          <p className="border px-3 py-2 font-mono text-xs" style={{
            borderColor: status === "error" ? "var(--term-neg)" : "var(--term-pos)",
            color: status === "error" ? "var(--term-neg)" : "var(--term-pos)",
          }}>{message}</p>
        )}

        <button type="submit" disabled={!file || status === "uploading"}
          className="flex w-full items-center justify-center gap-2 bg-[var(--term-accent)] py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--term-bg)] transition disabled:cursor-not-allowed disabled:bg-[var(--term-grid)] disabled:text-[var(--term-muted)]">
          {status === "uploading" ? <><Loader2 size={15} className="animate-spin" /> Processing…</> : "Process Statement"}
        </button>
      </form>
    </SurfaceCard>
  );
}
