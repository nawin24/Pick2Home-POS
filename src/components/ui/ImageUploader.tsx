"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";

type Props = {
  value: string;
  onChange: (url: string) => void;
  folder?: string;       // organizes uploads by feature
  label?: string;
  className?: string;
};

type Backend = "firebase" | "local";

// Image input that uploads to Firebase Storage when configured and falls back
// to the local public/uploads/ folder otherwise. Same UI either way.
export default function ImageUploader({ value, onChange, folder = "menu", label, className }: Props) {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/uploads")
      .then((r) => r.json())
      .then((d) => setBackend(d.backend))
      .catch(() => setBackend("local"));
  }, []);

  async function upload(file: File) {
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed");
      onChange(d.url);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      {label && <div className="label">{label}</div>}
      <div className="flex items-start gap-3">
        {/* Preview */}
        <div className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-slate-300" />
          )}
        </div>

        <div className="flex-1 space-y-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <div className="flex flex-wrap gap-1 items-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="btn btn-secondary text-xs"
            >
              <Upload size={14} /> {busy ? "Uploading…" : value ? "Replace" : "Upload"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="btn btn-ghost text-xs text-red-600"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            PNG / JPG / WebP up to 5 MB · stored in{" "}
            {backend === "firebase" ? (
              <span className="text-orange-700 font-medium">Firebase Storage</span>
            ) : (
              <span className="text-slate-700 font-medium">local <code>public/uploads/</code></span>
            )}
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
        </div>
      </div>
    </div>
  );
}
