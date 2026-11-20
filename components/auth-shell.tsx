import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, ClipboardCheck, Trophy } from "lucide-react";

import { Logo } from "@/components/logo";

const POINTS = [
  { Icon: CalendarDays, text: "Build fight cards and run event day from one place" },
  { Icon: ClipboardCheck, text: "Fighter records, weigh-ins and medicals kept together" },
  { Icon: Trophy, text: "Live scoring and results the moment the bell rings" },
];

// Shared frame for the sign-in and sign-up pages: the form on one side, a
// brand panel on the other (hidden on small screens).
export function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-10">
        <div className={`mx-auto w-full ${wide ? "max-w-xl" : "max-w-sm"}`}>
          <Link href="/" className="mb-8 flex items-center gap-2 self-start">
            <Logo size={28} />
            <span className="font-heading text-base font-semibold tracking-wide">CombatPro</span>
          </Link>
          {children}
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-neutral-950 text-white lg:block">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at 20% 25%, rgba(220,38,38,0.4), transparent 50%), radial-gradient(ellipse at 80% 75%, rgba(30,64,175,0.45), transparent 55%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-center p-12 xl:p-16">
          <p className="text-xs uppercase tracking-[0.3em] text-brand">Combat sports, organised</p>
          <h2 className="mt-4 max-w-md font-heading text-4xl font-semibold leading-tight tracking-tight">
            Everything for fight night, from first sign-up to final bell.
          </h2>
          <ul className="mt-10 space-y-4">
            {POINTS.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Icon className="h-4 w-4 text-brand" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
