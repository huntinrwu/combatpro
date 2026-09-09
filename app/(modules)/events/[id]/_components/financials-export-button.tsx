import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function FinancialsExportButton({ eventId }: { eventId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm" variant="outline">
            <Download className="h-3.5 w-3.5" />
            Export
            <ChevronDown className="h-3 w-3" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          render={
            <a
              href={`/api/events/${eventId}/ledger/csv`}
              download
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Ledger — CSV</span>
            </a>
          }
        />
        <DropdownMenuItem
          render={
            <a
              href={`/api/events/${eventId}/ledger/pdf`}
              target="_blank"
              rel="noopener"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>P&amp;L report — PDF</span>
            </a>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
