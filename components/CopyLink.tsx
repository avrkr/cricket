"use client";
import { useState } from "react";

export default function CopyLink({ path, label }: { path: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn-alt" onClick={async () => {
      await navigator.clipboard.writeText(location.origin + path); setDone(true); setTimeout(() => setDone(false), 1500);
    }}>{done ? "✔ Copied" : label}</button>
  );
}
