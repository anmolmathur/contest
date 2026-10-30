"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface MemberRow {
  email: string;
  name: string;
}

type LookupResult =
  | { status: "new" }
  | { status: "available"; name: string | null }
  | { status: "in_team" }
  | { status: "not_participant" }
  | { status: "invalid" };

interface MemberEmailRowProps {
  apiBase: string;
  teamWord: string;
  value: MemberRow;
  onChange: (value: MemberRow) => void;
  onRemove?: () => void;
}

/** One teammate: email first, then their name fills in or is asked for. */
export default function MemberEmailRow({
  apiBase,
  teamWord,
  value,
  onChange,
  onRemove,
}: MemberEmailRowProps) {
  const [lookup, setLookup] = useState<LookupResult | null>(null);

  const handleBlur = async () => {
    const email = value.email.trim();
    if (!email) {
      setLookup(null);
      return;
    }
    try {
      const res = await fetch(`${apiBase}/teams/lookup-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 400) {
        setLookup({ status: "invalid" });
      } else if (res.ok) {
        setLookup(await res.json());
      }
    } catch {
      // The server re-checks every email when the form is submitted.
      setLookup(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="email"
          value={value.email}
          onChange={(e) => {
            setLookup(null);
            onChange({ email: e.target.value, name: "" });
          }}
          onBlur={handleBlur}
          placeholder="teammate@email.com"
          aria-label="Teammate email"
          className="bg-white/5 border-white/10 text-white"
        />
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remove teammate"
            className="text-gray-400 hover:text-white"
          >
            <X size={16} />
          </Button>
        )}
      </div>
      {lookup?.status === "new" && (
        <>
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Teammate's full name"
            aria-label="Teammate name"
            className="bg-white/5 border-white/10 text-white"
          />
          <p className="text-xs text-gray-500">
            New here. They&apos;ll get an email to set a password.
          </p>
        </>
      )}
      {lookup?.status === "available" && (
        <p className="text-xs text-emerald-400">{lookup.name || "Registered participant"}</p>
      )}
      {lookup?.status === "in_team" && (
        <p className="text-xs text-red-400">
          Already in a {teamWord.toLowerCase()} for this contest.
        </p>
      )}
      {lookup?.status === "not_participant" && (
        <p className="text-xs text-red-400">Not a participant in this contest.</p>
      )}
      {lookup?.status === "invalid" && (
        <p className="text-xs text-red-400">Enter a valid email address.</p>
      )}
    </div>
  );
}
