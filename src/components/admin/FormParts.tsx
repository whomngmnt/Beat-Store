"use client";

// Pieces the admin forms share: sending a form to its server action, the
// answer under the button, and a labelled field with its errors.
import { startTransition, useActionState, type FormEvent } from "react";
import type { FormResult } from "@/lib/validators";

type Action = (
  previous: FormResult | undefined,
  formData: FormData,
) => Promise<FormResult>;

// Sends the form without React's automatic form reset, so what the admin
// typed stays in the fields when the server says something is wrong.
// The clicked button's name and value go along (the beat status buttons).
export function useFormAction(action: Action) {
  const [result, dispatch, pending] = useActionState(action, undefined);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }
  return { result, onSubmit, pending };
}

export function Message({ result }: { result?: FormResult }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={result.ok ? "text-sm" : "text-sm text-destructive"}
    >
      {result.message}
    </p>
  );
}

// `id` must match the input's id, so the label points at it.
export function Field({
  label,
  id,
  errors,
  hint,
  children,
}: {
  label: string;
  id: string;
  errors?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors?.map((error) => (
        <p key={error} className="text-xs text-destructive">
          {error}
        </p>
      ))}
    </div>
  );
}

// The same look as <Input>, for multi-line plain text.
export const textareaClass =
  "rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm dark:bg-input/30";
