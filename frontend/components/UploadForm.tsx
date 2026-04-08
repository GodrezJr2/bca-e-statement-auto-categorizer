"use client";
import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Upload, FileText, X, Loader2 } from "lucide-react";

interface UploadFormProps { onSuccess: () => void; }

export function UploadForm({ onSuccess }: UploadFormProps) {
  const [file, setFile]         = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus]     = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage]   = useState<string | null>(null);
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

    const res = await fetch(`${apiUrl}/api/upload-statement`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    });

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
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "Sora, sans-serif" }}>
        Upload e-Statement
      </h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className="relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 flex flex-col items-center justify-center py-6 px-4 text-center"
          style={{
            borderColor: dragging ? "var(--accent-blue)" : "var(--border)",
            background: dragging ? "#EFF6FF" : "#F8FAFC",
          }}>
          <input ref={inputRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <div className="flex items-center gap-2">
              <FileText size={18} style={{ color: "var(--accent-blue)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{file.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                <X size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
          ) : (
            <>
              <Upload size={22} className="mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Drag &amp; drop e-Statement PDF</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>or click to browse</p>
            </>
          )}
        </div>

        {/* Password */}
        <div className="relative">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Statement Password (optional)"
            className="w-full text-sm px-4 py-2.5 rounded-xl outline-none transition-all"
            style={{
              background: "#F8FAFC",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontFamily: "DM Sans, sans-serif",
            }}
          />
        </div>

        {message && (
          <p className="text-xs px-1" style={{ color: status === "error" ? "var(--expense-red)" : "var(--income-green)" }}>
            {message}
          </p>
        )}

        <button type="submit" disabled={!file || status === "uploading"}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
          style={{
            background: !file || status === "uploading" ? "#CBD5E1" : "var(--accent-blue)",
            cursor: !file || status === "uploading" ? "not-allowed" : "pointer",
          }}>
          {status === "uploading" ? (
            <><Loader2 size={15} className="animate-spin" /> Processing&hellip;</>
          ) : "Process Statement"}
        </button>
      </form>
    </div>
  );
}
