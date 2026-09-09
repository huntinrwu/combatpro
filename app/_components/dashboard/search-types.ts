export type SearchHit =
  | {
      kind: "fighter";
      id: string;
      title: string;
      subtitle: string | null;
      href: string;
    }
  | {
      kind: "event";
      id: string;
      title: string;
      subtitle: string | null;
      href: string;
    };
