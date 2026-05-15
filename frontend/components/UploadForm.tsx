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
    <SurfaceCard>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-[-0.03em]">Upload e-Statement</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">PDF, password optional</p>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[var(--apple-blue)] text-white">
          <Upload size={16} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="relative flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed px-4 py-7 text-center transition"
          style={{
            borderColor: dragging ? "var(--apple-blue)" : "var(--border)",
            background: dragging ? "rgba(0,122,255,0.08)" : "rgba(255,255,255,0.62)",
          }}
        >
          <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-[var(--apple-blue)]" />
              <span className="max-w-48 truncate text-sm font-medium">{file.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="rounded-full p-1 hover:bg-black/[0.05]">
                <X size={14} className="text-[var(--text-muted)]" />
              </button>
            </div>
          ) : (
            <>
              <Upload size={23} className="mb-2 text-[var(--text-muted)]" />
              <p className="text-sm font-medium text-[var(--text-secondary)]">Drop e-Statement PDF</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">or click to browse</p>
            </>
          )}
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Statement password (optional)"
          className="w-full rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-3 text-sm outline-none transition focus:border-[var(--apple-blue)] focus:ring-4 focus:ring-blue-500/10"
        />

        {message && (
          <p className="rounded-2xl px-3 py-2 text-xs" style={{
            background: status === "error" ? "#fff1f0" : "#ecfdf3",
            color: status === "error" ? "var(--expense-red)" : "var(--income-green)",
          }}>{message}</p>
        )}

        <button type="submit" disabled={!file || status === "uploading"}
          className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#c7c7cc]"
          style={{ background: !file || status === "uploading" ? "#c7c7cc" : "var(--apple-blue)" }}>
          {status === "uploading" ? <><Loader2 size={15} className="animate-spin" /> Processing…</> : "Process Statement"}
        </button>
      </form>
    </SurfaceCard>
  );
}
