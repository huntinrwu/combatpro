import { createGym } from "../actions";
import { GymForm } from "../_components/gym-form";

export default function NewGymPage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">New gym</h1>
        <p className="mt-1 text-sm text-muted-foreground">Only name is required.</p>
      </header>

      <GymForm action={createGym} submitLabel="Create gym" cancelHref="/gyms" />
    </>
  );
}
