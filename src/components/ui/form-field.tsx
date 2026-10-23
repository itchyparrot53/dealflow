"use client";
import type React from "react";
import { Children, cloneElement, isValidElement, useId } from "react";
import { cn } from "@/lib/utils";

// The one field rhythm (PLAN-PART12.md 6.3, U8): label, control, then hint or error. Every create
// dialog and settings form uses it so label size, gap and error treatment stop varying per screen.
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  span,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  // "full" makes the field span both columns of a FormGrid columns={2}.
  span?: "full";
  className?: string;
  children: React.ReactNode;
}): React.ReactNode {
  // A required field announces itself to assistive tech on the control, not only through the
  // asterisk (which is decorative). The error needs the same treatment: a stable id the control
  // points at with aria-describedby, plus aria-invalid. Only a single element child can carry
  // these attributes, which is why the shared helper clones the control.
  const generatedId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hasError = error !== undefined && error !== null;
  const errorId = `${htmlFor ?? `form-field-${generatedId}`}-error`;
  const child = withFieldState(children, { required, errorId: hasError ? errorId : undefined });
  return (
    <div className={cn("grid gap-1.5", span === "full" && "sm:col-span-2", className)}>
      <span className="flex items-center gap-0.5">
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {/* Outside the label element, so getByLabelText("Value") keeps matching exactly. */}
        {required ? (
          <span aria-hidden="true" className="text-muted-foreground">
            *
          </span>
        ) : null}
      </span>
      {child}
      {error !== undefined && error !== null ? (
        <p id={errorId} role="alert" className="text-meta text-danger">
          {error}
        </p>
      ) : hint !== undefined && hint !== null ? (
        <p className="text-meta text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface FieldState {
  required: boolean;
  // Undefined means "no error", so the control must not claim to be invalid.
  errorId: string | undefined;
}

function withFieldState(
  child: React.ReactNode,
  { required, errorId }: FieldState,
): React.ReactNode {
  if (!isValidElement(child) || Children.count(child) !== 1) return child;
  const element = child as React.ReactElement<{
    "aria-required"?: boolean;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
  if (!required && errorId === undefined) return element;
  // Merge rather than replace: a control may already describe itself with a hint.
  const describedBy = element.props["aria-describedby"];
  return cloneElement(element, {
    ...(required ? { "aria-required": true } : {}),
    ...(errorId === undefined
      ? {}
      : {
          "aria-invalid": true,
          "aria-describedby": describedBy === undefined ? errorId : `${describedBy} ${errorId}`,
        }),
  });
}

// The shared field grid. Two columns stack below sm; a child marked data-span="full" spans both.
export function FormGrid({
  columns = 1,
  className,
  children,
}: {
  columns?: 1 | 2;
  className?: string;
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "sm:grid-cols-2 sm:gap-x-4 sm:[&>[data-span=full]]:col-span-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
