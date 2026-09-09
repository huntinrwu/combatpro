import { createOfficial } from "../actions";
import { OfficialForm } from "../_components/official-form";

export default function NewOfficialPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">New official</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only name and role are required.
        </p>
      </header>

      <OfficialForm
        action={createOfficial}
        submitLabel="Create official"
        cancelHref="/officials"
      />
    </>
  );
}
