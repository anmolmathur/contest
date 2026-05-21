"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Drop-in replacement for `<Input type="password" ... />` that adds a
 * trailing eye-icon toggle. Same props surface as <Input>, plus optional
 * `defaultVisible` if you want the field to start in shown state.
 *
 * Implementation notes:
 *   - We control visibility with internal state and flip the underlying
 *     <Input>'s `type` between "password" and "text". Browser autofill
 *     stays attached to the same node, so password managers still work.
 *   - The toggle button has no `type` of its own → defaults to "submit"
 *     in some browsers; we explicitly set type="button" so clicking the
 *     eye doesn't submit the surrounding form.
 *   - Right padding (`pr-10`) on the input ensures characters don't
 *     overlap the icon at narrow widths.
 *   - aria-pressed / aria-label keep the toggle accessible to screen
 *     readers.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, "type"> & {
    defaultVisible?: boolean;
  }
>(({ className, defaultVisible = false, ...props }, ref) => {
  const [visible, setVisible] = React.useState(defaultVisible);

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-center px-3",
          "text-gray-400 hover:text-white transition-colors",
          "focus-visible:outline-none focus-visible:text-white",
        )}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
});

PasswordInput.displayName = "PasswordInput";
