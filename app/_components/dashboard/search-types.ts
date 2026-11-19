export type SearchHit = {
  kind: "fighter" | "event";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};
