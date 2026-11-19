// Label/value row used inside the detail-page cards. Nullish values render
// as an em dash.
export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value ?? <em className="text-muted-foreground">—</em>}</span>
    </div>
  );
}
