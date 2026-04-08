"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UploadFormProps {
  onSuccess: () => void;
}

export function UploadForm({ onSuccess }: UploadFormProps) {
  const [file, setFile]         = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [status, setStatus]     = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("uploading");
    setMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus("error"); setMessage("Not authenticated."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setStatus("error"); setMessage("Session expired. Please reload."); return; }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setStatus("error");
      setMessage("API URL is not configured.");
      return;
    }

    const res = await fetch(
      `${apiUrl}/api/upload-statement`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed." }));
      setStatus("error");
      setMessage(err.detail ?? "Upload failed.");
      return;
    }

    const data = await res.json();
    setStatus("done");
    setMessage(`Inserted ${data.inserted} transactions.`);
    setFile(null);
    setPassword("");
    onSuccess();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Upload e-Statement</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="pdf">PDF File</Label>
            <Input id="pdf" type="file" accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pdfpw">PDF Password (leave blank if none)</Label>
            <Input id="pdfpw" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="optional" />
          </div>
          {message && (
            <p className={`text-sm ${status === "error" ? "text-red-500" : "text-green-600"}`}>
              {message}
            </p>
          )}
          <Button type="submit" disabled={status === "uploading"} className="w-full">
            {status === "uploading" ? "Processing\u2026" : "Upload & Analyze"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
