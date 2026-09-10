"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PageNav() {
  const router = useRouter();
  return (
    <div className="mb-4 flex items-center gap-1 print:hidden">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => router.back()}
        aria-label="Go back"
        title="Back"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => router.forward()}
        aria-label="Go forward"
        title="Forward"
      >
        Forward
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        render={
          <Link href="/" aria-label="Go to dashboard" title="Home">
            <Home className="h-3.5 w-3.5" />
            Home
          </Link>
        }
      />
    </div>
  );
}
