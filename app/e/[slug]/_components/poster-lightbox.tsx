"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// A poster that opens full size in a pop-up over the page instead of a new
// tab. Click anywhere, press Escape, or use the X to close.
export function PosterLightbox({
  src,
  alt,
  className,
  imgClassName,
  lazy = false,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  lazy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="View poster full size"
        className={cn("block cursor-zoom-in", className)}
      >
        {/* Served by our own cached route; the storage bucket is private. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading={lazy ? "lazy" : undefined} className={imgClassName} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/85 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup
          aria-label={alt}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center p-4 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
          <Dialog.Close
            aria-label="Close"
            className="absolute top-3 right-3 cursor-pointer rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
          >
            <XIcon className="h-5 w-5" />
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
