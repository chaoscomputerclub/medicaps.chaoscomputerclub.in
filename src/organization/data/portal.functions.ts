import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";

export const getPublicPortalData = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Portal data service is unavailable.");

  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const [contests, problems, standings, announcements, proofs] = await Promise.all([
    client.from("offline_contests").select("id, slug, title, season, status, division, starts_at, ends_at, check_in_opens_at, venue, seat_capacity, registered_count, problem_count, environment, chief_proctors, prize_pool, sponsor, summary, rules").order("starts_at"),
    client.from("contest_problems").select("contest_id, problem_index, title, topic, points, solved_count, first_ac_seconds, editorial_summary").order("problem_index"),
    client.from("scoreboard_entries").select("contest_id, rank, handle, full_name, department, batch, division, score, solved, penalty_seconds, rating_delta, telemetry").order("rank"),
    client.from("announcements").select("id, kind, title, summary, published_at, contest_slug").order("published_at", { ascending: false }),
    client.from("trust_proofs").select("certificate_id, contest_id, member_handle, contest_title, session_uuid, prn_hash, sha256_digest, proctor_stamp, attendance_stamp, score, rank, issued_at, status"),
  ]);

  const error = contests.error ?? problems.error ?? standings.error ?? announcements.error ?? proofs.error;
  if (error) throw new Error("Official contest records could not be loaded.");
  return {
    contests: contests.data ?? [],
    problems: problems.data ?? [],
    standings: standings.data ?? [],
    announcements: announcements.data ?? [],
    proofs: proofs.data ?? [],
  };
});