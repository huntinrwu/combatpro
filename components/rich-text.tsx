import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// **bold** inside a line. Everything else is plain text, so nothing a
// promoter types can turn into markup.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "para"; lines: string[] };

// Text a promoter wrote for a public page. People paste from notes apps and
// chat tools, so the common plain-text conventions are honoured: blank lines
// separate paragraphs, lines starting with "-" or "*" are a list, "#" lines
// are headings and **double asterisks** are bold.
export function RichText({
  text,
  className,
  // A leading heading that only repeats the section title is dropped.
  skipHeading,
}: {
  text: string;
  className?: string;
  skipHeading?: string;
}) {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (!line) {
      // A blank line ends the current paragraph or list.
      if (last && last.kind !== "heading") blocks.push({ kind: "para", lines: [] });
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", text: heading[1].replace(/\*\*/g, "") });
    } else if (bullet) {
      if (last?.kind === "list") last.items.push(bullet[1]);
      else blocks.push({ kind: "list", items: [bullet[1]] });
    } else if (last?.kind === "para") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "para", lines: [line] });
    }
  }

  const shown = blocks.filter((b, i) => {
    if (b.kind === "para") return b.lines.length > 0;
    if (b.kind === "heading" && i === 0 && skipHeading) {
      return b.text.trim().toLowerCase() !== skipHeading.trim().toLowerCase();
    }
    return true;
  });

  return (
    <div className={cn("space-y-3 text-sm leading-relaxed", className)}>
      {shown.map((b, i) =>
        b.kind === "heading" ? (
          <h3 key={i} className="pt-1 font-heading text-base font-semibold tracking-tight">
            {b.text}
          </h3>
        ) : b.kind === "list" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {b.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(line)}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
