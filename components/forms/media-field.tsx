"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MediaKind =
  | "sponsor-logo"
  | "fighter-photo"
  | "official-photo"
  | "gym-logo"
  | "promotion-logo"
  | "sb-logo"
  | "commission-logo";

type Aspect = "square" | "round" | "wide";

type Props = {
  name: string;
  id?: string;
  kind: MediaKind;
  defaultValue?: string | null;
  disabled?: boolean;
  aspect?: Aspect;
  label?: {
    empty?: string;
    placeholder?: string;
  };
};

// URL input + drag-drop uploader in one field. Whichever the user
// interacts with wins — a drop uploads and overwrites the URL; typing
// clears the local file state. Hidden input keeps the FormData contract
// identical to a plain URL input, so server actions don't need to change.
//
// `kind` routes to /api/upload/[kind] which auth-gates + stores under
// media/<folder>/. `aspect` only affects the preview thumbnail shape.
export function MediaField({
  name,
  id,
  kind,
  defaultValue,
  disabled = false,
  aspect = "square",
  label,
}: Props) {
  const [url, setUrl] = useState<string>(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const previewShape = aspect === "round" ? "rounded-full" : "rounded-md";
  const previewDim = aspect === "wide" ? "h-10 w-20" : "h-14 w-14";

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/upload/${kind}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Upload failed (${res.status})`);
      }
      const { url: uploadedUrl } = (await res.json()) as { url: string };
      setUrl(uploadedUrl);
      toast.success("Uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragActive(false);
    }
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  const emptyLabel = label?.empty ?? "Drop an image or click to upload";
  const placeholder = label?.placeholder ?? "https://…/image.png";

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} />

      <div className="relative">
        <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="url"
          placeholder={placeholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={disabled || uploading}
          className="pl-8 pr-8"
        />
        {url && (
          <button
            type="button"
            onClick={() => setUrl("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear"
            disabled={uploading}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload file"
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border/70 bg-muted/20 p-4 text-center transition-colors outline-none",
          "hover:border-foreground/40 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50",
          dragActive && "border-primary/70 bg-primary/5",
          (disabled || uploading) && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="hidden"
          disabled={disabled || uploading}
        />
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <div className="text-xs text-muted-foreground">Uploading…</div>
          </>
        ) : url ? (
          <div className="flex w-full items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Preview"
              className={cn(
                "border border-border/60 bg-white object-contain p-1",
                previewShape,
                previewDim,
              )}
            />
            <div className="min-w-0 flex-1 text-left">
              <div className="text-xs font-medium">Set</div>
              <div className="truncate text-[10px] text-muted-foreground">{url}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Upload className="h-3 w-3" />
                Drop or click to replace
              </div>
            </div>
          </div>
        ) : (
          <>
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
            <div className="text-xs font-medium">{emptyLabel}</div>
            <div className="text-[10px] text-muted-foreground">
              PNG, JPG, WEBP, SVG, GIF
            </div>
          </>
        )}
      </div>
    </div>
  );
}
