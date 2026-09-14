-- Account identity created at first sign-in (name + username only), account
-- settings, achievements catalogue, and a safe public leaderboard projection.

CREATE TABLE IF NOT EXISTS public.member_accounts (
  id uuid PRIMARY KEY,
  username text NOT NULL,
  full_name text NOT NULL,
  email text,
  avatar_url text,
  bio text,
  department text,
  batch text,
  prn text,
  onboarded_at timestamptz NOT NULL DEFAULT now(),
  notify_operations boolean NOT NULL DEFAULT true,
  notify_editorials boolean NOT NULL DEFAULT true,
  notify_rating_updates boolean NOT NULL DEFAULT true,
  notify_email_digest boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_accounts TO authenticated;
GRANT ALL ON public.member_accounts TO service_role;
ALTER TABLE public.member_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own account" ON public.member_accounts
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Members create own account" ON public.member_accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Members update own account" ON public.member_accounts
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Members delete own account" ON public.member_accounts
  FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE UNIQUE INDEX IF NOT EXISTS member_accounts_username_lower_key
  ON public.member_accounts (lower(username));

CREATE OR REPLACE FUNCTION public.username_available(candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT candidate ~ '^[a-z0-9._]{3,20}$'
     AND NOT EXISTS (
       SELECT 1 FROM public.member_accounts WHERE lower(username) = lower(candidate)
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.member_profiles WHERE lower(handle) = lower(candidate)
     );
$$;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.achievement_definitions (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.achievement_definitions TO anon, authenticated;
GRANT ALL ON public.achievement_definitions TO service_role;
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads achievement definitions" ON public.achievement_definitions
  FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.member_achievements (
  member_id uuid NOT NULL,
  code text NOT NULL REFERENCES public.achievement_definitions(code) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, code)
);
GRANT SELECT ON public.member_achievements TO authenticated;
GRANT ALL ON public.member_achievements TO service_role;
ALTER TABLE public.member_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own achievements" ON public.member_achievements
  FOR SELECT TO authenticated USING (auth.uid() = member_id);

CREATE OR REPLACE VIEW public.leaderboard_public
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.handle AS username,
  p.full_name,
  p.department,
  p.batch,
  p.rating,
  p.peak_rating,
  p.attendance_count,
  p.attendance_total,
  p.is_core_member,
  ROW_NUMBER() OVER (ORDER BY p.rating DESC, p.full_name)::integer AS university_rank,
  (COUNT(*) OVER ())::integer AS active_members
FROM public.member_profiles p;
GRANT SELECT ON public.leaderboard_public TO anon, authenticated;