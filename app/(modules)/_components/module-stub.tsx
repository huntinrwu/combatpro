import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  tagline: string;
  bullets: string[];
};

export function ModuleStub({ title, tagline, bullets }: Props) {
  return (
    <>
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planned scope</CardTitle>
          <CardDescription>
            Placeholder — this module is scaffolded but not implemented yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
