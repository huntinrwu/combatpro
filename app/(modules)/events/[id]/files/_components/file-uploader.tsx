"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadEventFile } from "../actions";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  EVENT_FILE_ACCEPT,
  EVENT_FILE_CATEGORIES,
  EVENT_FILE_CATEGORY_LABELS,
  EVENT_FILE_MAX_BYTES,
  eventFileExt,
  fmtFileSize,
  type EventFileCategory,
} from "@/lib/event-files";

// Drop zone + picker. Files go up one at a time so a big poster can't push a
// request over the size limit and each failure names its own file.
export function FileUploader({ eventId }: { eventId: string }) {
  const [category, setCategory] = useState<EventFileCategory>("poster");
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = progress !== null;

  async function upload(files: File[]) {
    if (files.length === 0 || busy) return;
    let ok = 0;
    setProgress({ done: 0, total: files.length });
    for (const [i, file] of files.entries()) {
      // Cheap checks first so an obviously wrong file doesn't get uploaded.
      if (!eventFileExt(file.name)) {
        toast.error(`${file.name}: that file type isn't allowed.`);
      } else if (file.size > EVENT_FILE_MAX_BYTES) {
        toast.error(`${file.name} is over ${fmtFileSize(EVENT_FILE_MAX_BYTES)}.`);
      } else {
        const fd = new FormData();
        fd.set("event_id", eventId);
        fd.set("category", category);
        fd.set("file", file);
        try {
          await uploadEventFile(fd);
          ok++;
        } catch (err) {
          toast.error(err instanceof Error && err.message ? err.message : `${file.name} failed.`);
        }
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
    if (ok > 0) toast.success(ok === 1 ? "File uploaded" : `${ok} files uploaded`);
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs text-muted-foreground">
        These files are
        <NativeSelect
          value={category}
          onChange={(e) => setCategory(e.target.value as EventFileCategory)}
          disabled={busy}
          className="mt-1"
        >
          {EVENT_FILE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EVENT_FILE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </NativeSelect>
      </label>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          upload([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border/70 bg-muted/20 p-6 text-center outline-none transition-colors",
          "hover:border-foreground/40 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50",
          dragActive && "border-primary/70 bg-primary/5",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={EVENT_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => upload([...(e.target.files ?? [])])}
        />
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…
            </div>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div className="text-xs font-medium">Drop files here or click to choose</div>
            <div className="text-[10px] text-muted-foreground">
              Images, PDF, Word, Excel, CSV, text · up to {fmtFileSize(EVENT_FILE_MAX_BYTES)} each
            </div>
          </>
        )}
      </div>
    </div>
  );
}
