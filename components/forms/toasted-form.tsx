"use client";

import { useRef, useTransition, type FormHTMLAttributes, type ReactNode } from "react";
import { toast } from "sonner";

type ServerAction = (formData: FormData) => Promise<void> | void;

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: ServerAction;
  successMessage?: string;
  resetOnSuccess?: boolean;
  children: ReactNode;
};

// Thin wrapper around <form action={serverAction}> that surfaces success/error
// via sonner toasts. No progressive enhancement — this form requires JS. Use
// when the user benefit of feedback outweighs the no-JS trade-off (which for
// authenticated app-shell pages is basically always).
export function ToastedForm({
  action,
  successMessage,
  resetOnSuccess = false,
  children,
  ...rest
}: Props) {
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      {...rest}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        startTransition(async () => {
          try {
            await action(fd);
            if (successMessage) toast.success(successMessage);
            if (resetOnSuccess) form.reset();
          } catch (err) {
            const msg = err instanceof Error && err.message ? err.message : "Something went wrong.";
            toast.error(msg);
          }
        });
      }}
    >
      {children}
    </form>
  );
}
