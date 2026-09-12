CREATE TABLE public.member_profiles (
  id uuid PRIMARY KEY,
  handle text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  prn text UNIQUE NOT NULL,
  department text NOT NULL CHECK (department IN ('CSE','IT','AIDS','Cyber Security')),
  batch text NOT NULL CHECK (batch IN ('2022-26','2023-27','2024-28')),
  rating integer NOT NULL DEFAULT 1200,
  peak_rating integer NOT NULL DEFAULT 1200,
  attendance_count integer NOT NULL DEFAULT 0,
  attendance_total integer NOT NULL DEFAULT 0,
  is_core_member boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.member_profiles TO authenticated;
GRANT ALL ON public.member_profiles TO service_role;
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read profiles" ON public.member_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members create own profile" ON public.member_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Members update own profile" ON public.member_profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.offline_contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  season text NOT NULL,
  status text NOT NULL CHECK (status IN ('live','upcoming','finished')),
  division text NOT NULL CHECK (division IN ('division_1','division_2','division_3','open')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  check_in_opens_at timestamptz NOT NULL,
  venue text NOT NULL,
  seat_capacity integer NOT NULL,
  registered_count integer NOT NULL DEFAULT 0,
  problem_count integer NOT NULL,
  environment text NOT NULL,
  chief_proctors text[] NOT NULL DEFAULT '{}',
  prize_pool text,
  sponsor text,
  summary text NOT NULL,
  rules text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offline_contests TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.offline_contests TO authenticated;
GRANT ALL ON public.offline_contests TO service_role;
ALTER TABLE public.offline_contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads contests" ON public.offline_contests FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.contest_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.offline_contests(id) ON DELETE CASCADE,
  problem_index text NOT NULL,
  title text NOT NULL,
  topic text NOT NULL,
  points integer NOT NULL,
  solved_count integer NOT NULL DEFAULT 0,
  first_ac_seconds integer,
  editorial_summary text,
  UNIQUE (contest_id, problem_index)
);
GRANT SELECT ON public.contest_problems TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.contest_problems TO authenticated;
GRANT ALL ON public.contest_problems TO service_role;
ALTER TABLE public.contest_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads contest problems" ON public.contest_problems FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.scoreboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.offline_contests(id) ON DELETE CASCADE,
  member_id uuid,
  rank integer NOT NULL,
  handle text NOT NULL,
  full_name text NOT NULL,
  department text NOT NULL,
  batch text NOT NULL,
  division text NOT NULL,
  score integer NOT NULL,
  solved integer NOT NULL,
  penalty_seconds integer NOT NULL,
  rating_delta integer,
  telemetry jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (contest_id, rank)
);
GRANT SELECT ON public.scoreboard_entries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.scoreboard_entries TO authenticated;
GRANT ALL ON public.scoreboard_entries TO service_role;
ALTER TABLE public.scoreboard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads scoreboards" ON public.scoreboard_entries FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.rating_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  contest_id uuid REFERENCES public.offline_contests(id) ON DELETE SET NULL,
  contest_title text NOT NULL,
  contested_at timestamptz NOT NULL,
  old_rating integer NOT NULL,
  new_rating integer NOT NULL,
  rank integer NOT NULL
);
GRANT SELECT ON public.rating_history TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rating_history TO authenticated;
GRANT ALL ON public.rating_history TO service_role;
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own rating history" ON public.rating_history FOR SELECT TO authenticated USING (auth.uid() = member_id);

CREATE TABLE public.trust_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id text UNIQUE NOT NULL,
  contest_id uuid NOT NULL REFERENCES public.offline_contests(id) ON DELETE RESTRICT,
  member_id uuid,
  member_handle text NOT NULL,
  contest_title text NOT NULL,
  session_uuid uuid NOT NULL,
  prn_hash text NOT NULL,
  sha256_digest text UNIQUE NOT NULL,
  proctor_stamp text NOT NULL,
  attendance_stamp text NOT NULL,
  score integer NOT NULL,
  rank integer NOT NULL,
  issued_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','revoked'))
);
GRANT SELECT ON public.trust_proofs TO anon, authenticated;
GRANT INSERT, UPDATE ON public.trust_proofs TO authenticated;
GRANT ALL ON public.trust_proofs TO service_role;
ALTER TABLE public.trust_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public verifies result proofs" ON public.trust_proofs FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('editorial','podium','rating_update','operations')),
  title text NOT NULL,
  summary text NOT NULL,
  published_at timestamptz NOT NULL,
  contest_slug text,
  cta_label text
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads announcements" ON public.announcements FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.campus_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  contest_id uuid NOT NULL REFERENCES public.offline_contests(id) ON DELETE CASCADE,
  pass_code text UNIQUE NOT NULL,
  seat text NOT NULL,
  venue text NOT NULL,
  check_in_opens_at timestamptz NOT NULL,
  prn_hash text NOT NULL,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','checked_in','expired')),
  UNIQUE (member_id, contest_id)
);
GRANT SELECT ON public.campus_passes TO authenticated;
GRANT ALL ON public.campus_passes TO service_role;
ALTER TABLE public.campus_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own campus passes" ON public.campus_passes FOR SELECT TO authenticated USING (auth.uid() = member_id);

CREATE INDEX idx_contests_status_start ON public.offline_contests(status, starts_at);
CREATE INDEX idx_scoreboard_contest_division ON public.scoreboard_entries(contest_id, division, rank);
CREATE INDEX idx_proofs_digest ON public.trust_proofs(sha256_digest);
CREATE INDEX idx_rating_member_date ON public.rating_history(member_id, contested_at);