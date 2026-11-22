import { z } from "zod";

// All fields are strings (what a form gives us) so the same schema validates in the browser (RHF) and in server actions.
const req = z.string().trim().min(1, "Required");
const num = z.string().trim().regex(/^\d+$/, "Enter a whole number");
const optNum = z.string().trim().regex(/^\d*$/, "Enter a whole number");

export const signInSchema = z.object({ email: z.string().email(), password: z.string().min(6, "Min 6 characters") });

export const tournamentSchema = z.object({
  name: req, format: z.enum(["T10", "T20", "ODI", "Test", "Custom"]), num_teams: num, budget: num,
  min_squad: num, max_squad: num, overseas_limit: optNum, max_retentions: num,
}).refine((v) => Number(v.max_squad) >= Number(v.min_squad), { path: ["max_squad"], message: "Must be >= min squad" });

export const teamSchema = z.object({
  name: req, short_name: z.string().trim().min(2, "2-5 letters").max(5, "2-5 letters"),
  owner_name: req,
});

export const playerSchema = z.object({
  full_name: req, dob: req,
  role: z.enum(["Batsman", "Bowler", "All-rounder", "Wicketkeeper"]), jersey_no: optNum, base_price: optNum,
});

export type FieldDef = {
  name: string; label: string; span?: 2;
  type?: "text" | "number" | "date" | "email" | "datetime-local" | "color" | "file" | "textarea" | "select" | "checkbox";
  options?: string[]; placeholder?: string;
};
