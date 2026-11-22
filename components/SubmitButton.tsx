"use client";
import { useFormStatus } from "react-dom";
import { Spinner } from "./Skeleton";

// Drop-in for <button> inside a server-action <form>: shows a spinner and blocks double submits.
export default function SubmitButton({ className = "btn", children }: { className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className}>{pending && <Spinner />}{children}</button>;
}
