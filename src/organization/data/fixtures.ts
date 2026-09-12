/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import type {
  Achievement,
  ActivityItem,
  ClubEvent,
  Contest,
  LeaderboardRow,
  Member,
  Problem,
  StandingRow,
  Submission,
} from "./types";

/** Dates are generated relative to "now" so upcoming events stay upcoming. */
const now = () => new Date();
const days = (n: number, hour = 18, minute = 30) => {
  const d = now();
  d.setDate(d.getDate() + n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const hoursAgo = (n: number) => new Date(Date.now() - n * 3600_000).toISOString();

export const member: Member = {
  id: "mem_01hz3k",
  handle: "riya.k",
  full_name: "Riya Kulkarni",
  email: "riya.kulkarni@students.ccc.dev",
  avatar_url: null,
  bio: "Third year, mostly systems. Currently obsessed with why my toy database loses writes on power failure.",
  year: 3,
  branch: "Computer Science",
  skills: ["Rust", "Postgres", "Distributed systems", "C", "Linux", "Graph algorithms"],
  joined_at: "2025-08-11T05:30:00.000Z",
  stats: {
    problems_solved: 74,
    events_attended: 11,
    current_streak_days: 9,
    contributions: 32,
  },
};

export const newMember: Member = {
  id: "mem_01j92p",
  handle: "arjun.m",
  full_name: "Arjun Menon",
  email: "arjun.menon@students.ccc.dev",
  avatar_url: null,
  bio: null,
  year: 1,
  branch: "Electronics & Communication",
  skills: [],
  joined_at: hoursAgo(20),
  stats: {
    problems_solved: 0,
    events_attended: 0,
    current_streak_days: 0,
    contributions: 0,
  },
};

export const events: ClubEvent[] = [
  {
    id: "evt_hack_48",
    slug: "chaos-hack-48",
    title: "Chaos Hack 48",
    kind: "hackathon",
    mode: "onsite",
    summary: "48 hours, one constraint sheet handed out at the start. No theme reveal beforehand.",
    description:
      "Teams of three. The constraint sheet is handed out at kickoff and is not negotiable: no external APIs, a 20MB deploy budget, and the machine you demo on is chosen by lottery. Judging weighs whether the thing survives being used, not how it looks in slides. Bring your own hardware; power and floor space are provided.",
    starts_at: days(6, 9, 0),
    ends_at: days(8, 18, 0),
    location: "Lab 4C, Engineering Block",
    join_url: null,
    capacity: 90,
    registered_count: 81,
    state: "open",
    rsvp_status: "confirmed",
    tags: ["hackathon", "teams", "hardware allowed"],
  },
  {
    id: "evt_contest_ladder_14",
    slug: "pressure-ladder-14",
    title: "Pressure Ladder #14",
    kind: "contest",
    mode: "online",
    summary: "Five problems, ninety minutes, penalty on wrong submissions.",
    description:
      "The standing fortnightly contest. Five problems ordered by difficulty, ninety minutes, ICPC-style penalties. Ratings carry across the season and the top eight qualify for the winter invitational. Editorials are published within 24 hours and members are expected to write at least one of them per season.",
    starts_at: days(2, 20, 0),
    ends_at: days(2, 21, 30),
    location: null,
    join_url: "https://contests.ccc.dev/ladder/14",
    capacity: null,
    registered_count: 143,
    state: "open",
    rsvp_status: "confirmed",
    tags: ["contest", "rated", "individual"],
  },
  {
    id: "evt_meetup_teardown",
    slug: "teardown-night-postgres",
    title: "Teardown Night: Postgres WAL",
    kind: "meetup",
    mode: "onsite",
    summary: "We read the write-ahead log implementation out loud until it stops being scary.",
    description:
      "A reading session, not a talk. We open the source, project it, and work through how the write-ahead log actually gets flushed and replayed. Come with questions. Whoever asks the sharpest one gets to lead the next teardown.",
    starts_at: days(11, 18, 30),
    ends_at: days(11, 20, 30),
    location: "Seminar Hall 2",
    join_url: null,
    capacity: 40,
    registered_count: 27,
    state: "open",
    rsvp_status: "none",
    tags: ["meetup", "databases", "source reading"],
  },
  {
    id: "evt_meetup_break_it",
    slug: "break-it-night-03",
    title: "Break It Night 03",
    kind: "meetup",
    mode: "onsite",
    summary:
      "Bring a system you built. Someone else tries to break it. You fix it in front of everyone.",
    description:
      "Everyone brings something running. Machines are swapped, and the person across the table has thirty minutes to make yours fail. Then you debug it live with the room watching. There is no scoreboard — the point is that being wrong in public gets easier the second time.",
    starts_at: days(19, 18, 0),
    ends_at: days(19, 21, 0),
    location: "Lab 2A",
    join_url: null,
    capacity: 30,
    registered_count: 30,
    state: "closed",
    rsvp_status: "waitlisted",
    tags: ["meetup", "debugging", "capacity reached"],
  },
  {
    id: "evt_contest_night_sprint",
    slug: "night-sprint-graphs",
    title: "Night Sprint: Graphs Only",
    kind: "contest",
    mode: "online",
    summary: "Four graph problems, unrated, editorial written collectively afterwards.",
    description:
      "An unrated practice sprint for people who freeze on graph problems. Four problems, two hours, no penalty. Afterwards we write a single shared editorial in the channel — everyone contributes the part they solved.",
    starts_at: days(-5, 20, 0),
    ends_at: days(-5, 22, 0),
    location: null,
    join_url: "https://contests.ccc.dev/sprint/graphs",
    capacity: null,
    registered_count: 96,
    state: "past",
    rsvp_status: "confirmed",
    tags: ["contest", "unrated", "graphs"],
  },
  {
    id: "evt_hack_deploy_or_die",
    slug: "deploy-or-die",
    title: "Deploy or Die",
    kind: "hackathon",
    mode: "onsite",
    summary: "Six hours. If it isn't reachable on a public URL at the buzzer, it did not happen.",
    description:
      "A single-day build with one rule: at the buzzer we open your URL from a phone on the campus network. Local demos score zero. Half the room has never deployed anything before, which is exactly why this runs.",
    starts_at: days(-21, 10, 0),
    ends_at: days(-21, 16, 0),
    location: "Lab 4C, Engineering Block",
    join_url: null,
    capacity: 60,
    registered_count: 58,
    state: "past",
    rsvp_status: "confirmed",
    tags: ["hackathon", "deployment", "solo or pair"],
  },
];

export const problems: Problem[] = [
  {
    id: "prb_wal_replay",
    slug: "replay-a-torn-log",
    title: "Replay a Torn Log",
    difficulty: "hard",
    tags: ["systems", "durability", "parsing"],
    status: "attempted",
    summary: "A write-ahead log was cut mid-record by a power failure. Recover everything valid.",
    prompt:
      "You are handed a write-ahead log file that was being appended to when the machine lost power. Records are length-prefixed and checksummed, and the final record may be truncated at any byte. Reconstruct the key-value state implied by every intact record, in order, and report the byte offset where recovery stopped.\n\nA record is: 4-byte little-endian length, 4-byte CRC32 of the payload, then the payload. A record is valid only if the full payload is present and the checksum matches. Recovery stops at the first invalid record — everything after it is discarded, even if it happens to parse.",
    constraints: [
      "Log file up to 64 MiB; you may not load it entirely into memory.",
      "Payloads are up to 4 KiB each and never zero-length.",
      "A trailing run of zero bytes is padding, not a record.",
      "Output the recovered state sorted by key, then the stop offset.",
    ],
    starter_code:
      "use std::io::Read;\n\n/// Returns (recovered_pairs, stop_offset).\nfn recover(log: &mut impl Read) -> (Vec<(String, String)>, u64) {\n    todo!()\n}\n",
    language: "rust",
    attempts: 3,
    solved_by_count: 11,
    published_at: hoursAgo(60),
  },
  {
    id: "prb_rate_limit",
    slug: "rate-limit-under-a-thundering-herd",
    title: "Rate Limit Under a Thundering Herd",
    difficulty: "medium",
    tags: ["concurrency", "design", "algorithms"],
    status: "unsolved",
    summary: "Ten thousand clients wake at the same millisecond. Admit exactly the allowed share.",
    prompt:
      "Implement a rate limiter that admits at most N requests per sliding second per client key, and behaves correctly when thousands of requests for the same key arrive in the same millisecond across many threads. No request may be admitted beyond the limit, and no permit may be wasted while requests are waiting.",
    constraints: [
      "Up to 10,000 distinct keys, up to 50,000 requests per second total.",
      "No global lock held across an admission decision.",
      "Memory must not grow with idle keys — expire them.",
      "Monotonic clock only; wall-clock jumps must not admit extra requests.",
    ],
    starter_code:
      "class SlidingWindowLimiter {\n  constructor(limitPerSecond) {\n    this.limit = limitPerSecond;\n  }\n\n  /** @returns {boolean} true if the request is admitted */\n  admit(key, nowMs) {\n    throw new Error('not implemented');\n  }\n}\n",
    language: "javascript",
    attempts: 0,
    solved_by_count: 38,
    published_at: hoursAgo(120),
  },
  {
    id: "prb_shortest_detour",
    slug: "shortest-detour",
    title: "Shortest Detour",
    difficulty: "medium",
    tags: ["graphs", "shortest paths"],
    status: "solved",
    summary: "One edge on the campus network is about to be cut. Find the cheapest reroute.",
    prompt:
      "Given a weighted undirected graph, a source, a destination, and an edge that is about to be removed, report the shortest source-to-destination distance after the removal. Answer q such queries, each naming a different edge to remove. The graph itself never changes between queries.",
    constraints: [
      "1 ≤ nodes ≤ 200,000; 1 ≤ edges ≤ 400,000; 1 ≤ q ≤ 200,000.",
      "Edge weights are positive integers up to 10^9.",
      "Print -1 when the destination becomes unreachable.",
      "Two seconds, 256 MiB.",
    ],
    starter_code:
      "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // read graph, answer q removal queries\n    return 0;\n}\n",
    language: "cpp",
    attempts: 5,
    solved_by_count: 64,
    published_at: hoursAgo(300),
  },
  {
    id: "prb_parse_hostile",
    slug: "parse-something-hostile",
    title: "Parse Something Hostile",
    difficulty: "easy",
    tags: ["parsing", "edge cases"],
    status: "solved",
    summary: "A config format with three ways to write the same thing and no specification.",
    prompt:
      "You are given real config files scraped from four different projects that all claim to use the same format. They disagree. Write a parser that accepts all four, documents each ambiguity you found, and rejects anything genuinely malformed instead of guessing.",
    constraints: [
      "Files up to 1 MiB, UTF-8, possibly with a byte-order mark.",
      "Duplicate keys are last-one-wins; nested duplicates are an error.",
      "Comments may appear at end of line but not inside a quoted value.",
      "Report the line and column of the first rejection.",
    ],
    starter_code:
      'def parse(text: str) -> dict:\n    """Return the parsed config, or raise ParseError(line, column, reason)."""\n    raise NotImplementedError\n',
    language: "python",
    attempts: 2,
    solved_by_count: 112,
    published_at: hoursAgo(420),
  },
  {
    id: "prb_break_the_cache",
    slug: "break-the-cache",
    title: "Break the Cache",
    difficulty: "hard",
    tags: ["adversarial", "hashing", "systems"],
    status: "unsolved",
    summary: "Given this cache implementation, construct the input that makes it useless.",
    prompt:
      "The attached cache uses open addressing with a published hash function and a fixed capacity. Construct a request sequence of at most 5,000 keys that drives the average lookup cost above 200 probes, then propose the smallest change to the implementation that defeats your own attack. Both parts are graded.",
    constraints: [
      "You may not modify the cache while attacking it.",
      "Keys are printable ASCII, up to 32 bytes.",
      "Your fix must not increase memory use by more than 8 bytes per entry.",
      "Explain why the fix works; a fix without a reason scores half.",
    ],
    starter_code:
      "// Part 1: emit the adversarial key sequence, one per line.\n// Part 2: describe the minimal fix in the submission note.\npackage main\n\nfunc main() {\n}\n",
    language: "go",
    attempts: 0,
    solved_by_count: 4,
    published_at: hoursAgo(30),
  },
  {
    id: "prb_streak_math",
    slug: "count-the-honest-streaks",
    title: "Count the Honest Streaks",
    difficulty: "easy",
    tags: ["arrays", "counting"],
    status: "attempted",
    summary: "Activity logs with duplicate and out-of-order entries. Compute the real streak.",
    prompt:
      "Given a list of activity timestamps in an arbitrary order, possibly with duplicates and possibly spanning time zone changes, compute the longest run of consecutive calendar days with at least one activity, in the member's local time zone.",
    constraints: [
      "Up to 500,000 timestamps.",
      "Timestamps are ISO-8601 with offsets; offsets may differ across entries.",
      "Two activities on the same local day count once.",
      "Return 0 for an empty list.",
    ],
    starter_code:
      "export function longestStreak(timestamps: string[], timeZone: string): number {\n  throw new Error('not implemented');\n}\n",
    language: "typescript",
    attempts: 1,
    solved_by_count: 158,
    published_at: hoursAgo(200),
  },
];

export const activity: ActivityItem[] = [
  {
    id: "act_01",
    kind: "problem_solved",
    title: "Solved Shortest Detour",
    detail: "5th attempt · hard",
    occurred_at: hoursAgo(5),
  },
  {
    id: "act_02",
    kind: "contribution",
    title: "Wrote the editorial for Night Sprint: Graphs Only",
    detail: "Reviewed by 2 members",
    occurred_at: hoursAgo(26),
  },
  {
    id: "act_03",
    kind: "problem_attempted",
    title: "Attempted Replay a Torn Log",
    detail: "Checksum handling still wrong on truncated tail",
    occurred_at: hoursAgo(31),
  },
  {
    id: "act_04",
    kind: "event_registered",
    title: "Registered for Chaos Hack 48",
    detail: "Team of three",
    occurred_at: hoursAgo(48),
  },
  {
    id: "act_05",
    kind: "achievement_earned",
    title: "Earned Broke It, Fixed It",
    detail: "Debugged your own system live at Break It Night 02",
    occurred_at: hoursAgo(96),
  },
  {
    id: "act_06",
    kind: "event_attended",
    title: "Attended Night Sprint: Graphs Only",
    detail: "Finished 23rd of 96",
    occurred_at: hoursAgo(120),
  },
];

export const achievements: Achievement[] = [
  {
    id: "ach_first_contribution",
    name: "First Contribution",
    description: "Shipped something the club uses: an editorial, a fix, or a session you ran.",
    tier: "milestone",
    earned_at: hoursAgo(2400),
    progress: null,
  },
  {
    id: "ach_first_hackathon",
    name: "First Hackathon",
    description: "Finished a hackathon with something that ran at the buzzer.",
    tier: "milestone",
    earned_at: hoursAgo(1900),
    progress: null,
  },
  {
    id: "ach_broke_fixed",
    name: "Broke It, Fixed It",
    description: "Debugged your own failing system live, in front of the room.",
    tier: "milestone",
    earned_at: hoursAgo(96),
    progress: null,
  },
  {
    id: "ach_solved_50",
    name: "Fifty Solved",
    description: "Fifty problems solved across any difficulty.",
    tier: "progress",
    earned_at: hoursAgo(700),
    progress: { current: 74, target: 50 },
  },
  {
    id: "ach_solved_100",
    name: "Hundred Solved",
    description: "One hundred problems solved.",
    tier: "progress",
    earned_at: null,
    progress: { current: 74, target: 100 },
  },
  {
    id: "ach_hard_ten",
    name: "Ten Hard Problems",
    description: "Ten problems marked hard, solved.",
    tier: "progress",
    earned_at: null,
    progress: { current: 6, target: 10 },
  },
  {
    id: "ach_taught_five",
    name: "Taught Five",
    description: "Five members credited you with teaching them something.",
    tier: "progress",
    earned_at: null,
    progress: { current: 3, target: 5 },
  },
  {
    id: "ach_streak_30",
    name: "Thirty Day Streak",
    description: "Thirty consecutive days with at least one solve, review, or session.",
    tier: "progress",
    earned_at: null,
    progress: { current: 9, target: 30 },
  },
];

/** Achievements as a brand-new member sees them: nothing earned, nothing progressed. */
export const newMemberAchievements: Achievement[] = achievements.map((a) => ({
  ...a,
  earned_at: null,
  progress: a.progress ? { current: 0, target: a.progress.target } : null,
}));

export const submissions: Submission[] = [];

/* ---------------------------------------------------------------------------
 * Competition fixtures: contests, standings, leaderboards
 * ------------------------------------------------------------------------- */

const roster: { id: string; handle: string; name: string; year: number; branch: string }[] = [
  {
    id: "mem_01hz3k",
    handle: "riya.k",
    name: "Riya Kulkarni",
    year: 3,
    branch: "Computer Science",
  },
  { id: "mem_02aa11", handle: "devansh", name: "Devansh Rao", year: 4, branch: "Computer Science" },
  { id: "mem_02bb22", handle: "noor.s", name: "Noor Sheikh", year: 3, branch: "Information Tech" },
  {
    id: "mem_02cc33",
    handle: "kabir.t",
    name: "Kabir Thomas",
    year: 2,
    branch: "Computer Science",
  },
  {
    id: "mem_02dd44",
    handle: "aleena",
    name: "Aleena Fernandes",
    year: 4,
    branch: "Electronics & Communication",
  },
  { id: "mem_02ee55", handle: "harsh.v", name: "Harsh Vaidya", year: 2, branch: "Mechanical" },
  { id: "mem_02ff66", handle: "tanvi.b", name: "Tanvi Bhatt", year: 3, branch: "Computer Science" },
  {
    id: "mem_02gg77",
    handle: "imran.q",
    name: "Imran Qureshi",
    year: 1,
    branch: "Information Tech",
  },
  {
    id: "mem_02hh88",
    handle: "sneha.p",
    name: "Sneha Pillai",
    year: 2,
    branch: "Computer Science",
  },
  { id: "mem_02ii99", handle: "yash.d", name: "Yash Deshmukh", year: 1, branch: "Electrical" },
  {
    id: "mem_02jj10",
    handle: "meera.n",
    name: "Meera Nambiar",
    year: 4,
    branch: "Computer Science",
  },
  {
    id: "mem_01j92p",
    handle: "arjun.m",
    name: "Arjun Menon",
    year: 1,
    branch: "Electronics & Communication",
  },
];

const standingsFor = (order: number[], seed: number): StandingRow[] =>
  order.map((rosterIndex, i) => {
    const m = roster[rosterIndex]!;
    const solved = Math.max(1, 5 - Math.floor(i / 2));
    return {
      rank: i + 1,
      member_id: m.id,
      handle: m.handle,
      full_name: m.name,
      solved,
      penalty_minutes: 12 + i * 9 + (seed % 7) * 3,
      score: solved * 100 - (i * 4 + (seed % 5)),
      rating_delta: i < 3 ? 34 - i * 9 : i < 6 ? 6 - i : -(i * 3 - 4),
      is_you: m.id === member.id,
    };
  });

export const contests: Contest[] = [
  {
    id: "cst_ladder_14",
    slug: "pressure-ladder-14",
    title: "Pressure Ladder #14",
    format: "icpc",
    season: "Season 04",
    state: "upcoming",
    summary:
      "Five problems, ninety minutes, ICPC penalties. Ratings carry into the winter invitational.",
    description:
      "The fortnightly rated ladder. Problems are ordered by expected difficulty but not by the score they carry, so reading the whole set before starting is usually worth the four minutes it costs. Penalties are twenty minutes per rejected submission on a problem you eventually solve; rejections on problems you never solve cost nothing.",
    rules: [
      "Individual. Discussing a live problem with anyone, in any channel, voids both scorecards.",
      "Any language with a public toolchain. You are responsible for your own environment.",
      "Rejected submissions on a solved problem cost 20 penalty minutes each.",
      "The scoreboard freezes for the final fifteen minutes.",
      "Editorials are due within 24 hours from whoever claims a problem in the channel.",
    ],
    starts_at: days(2, 20, 0),
    ends_at: days(2, 21, 30),
    duration_minutes: 90,
    rated: true,
    registered_count: 143,
    problem_count: 5,
    registered: true,
    editorial_url: null,
    problems: [
      {
        index: "A",
        problem_slug: "count-the-honest-streaks",
        title: "Count the Honest Streaks",
        difficulty: "easy",
        points: 100,
        solved_by_count: 0,
        member_result: "untouched",
      },
      {
        index: "B",
        problem_slug: "parse-something-hostile",
        title: "Parse Something Hostile",
        difficulty: "easy",
        points: 200,
        solved_by_count: 0,
        member_result: "untouched",
      },
      {
        index: "C",
        problem_slug: "shortest-detour",
        title: "Shortest Detour",
        difficulty: "medium",
        points: 400,
        solved_by_count: 0,
        member_result: "untouched",
      },
      {
        index: "D",
        problem_slug: "rate-limit-under-a-thundering-herd",
        title: "Rate Limit Under a Thundering Herd",
        difficulty: "medium",
        points: 600,
        solved_by_count: 0,
        member_result: "untouched",
      },
      {
        index: "E",
        problem_slug: "replay-a-torn-log",
        title: "Replay a Torn Log",
        difficulty: "hard",
        points: 900,
        solved_by_count: 0,
        member_result: "untouched",
      },
    ],
    standings: [],
  },
  {
    id: "cst_teardown_open",
    slug: "teardown-clinic-live",
    title: "Teardown Clinic: Live Round",
    format: "teardown",
    season: "Season 04",
    state: "live",
    summary:
      "Running now. Read an unfamiliar codebase and answer questions about it under a clock.",
    description:
      "A live comprehension round. You get a repository you have never seen, forty minutes, and a list of questions that can only be answered by reading it: where does this write to disk, what happens on the second request, which of these three functions is dead. No running the code.",
    rules: [
      "Reading only. Executing the repository disqualifies the answer sheet.",
      "Answers must cite a file and line range.",
      "Partial credit is real: a wrong conclusion with correct evidence scores half.",
      "Forty minutes, no extensions for setup problems.",
    ],
    starts_at: hoursAgo(1),
    ends_at: days(0, 23, 59),
    duration_minutes: 40,
    rated: false,
    registered_count: 62,
    problem_count: 3,
    registered: true,
    editorial_url: null,
    problems: [
      {
        index: "A",
        problem_slug: "parse-something-hostile",
        title: "Where does the config win?",
        difficulty: "medium",
        points: 300,
        solved_by_count: 21,
        member_result: "solved",
      },
      {
        index: "B",
        problem_slug: "break-the-cache",
        title: "Find the dead path",
        difficulty: "medium",
        points: 300,
        solved_by_count: 14,
        member_result: "attempted",
      },
      {
        index: "C",
        problem_slug: "replay-a-torn-log",
        title: "Trace the flush",
        difficulty: "hard",
        points: 500,
        solved_by_count: 3,
        member_result: "untouched",
      },
    ],
    standings: standingsFor([2, 0, 1, 6, 4, 3, 8, 5], 3),
  },
  {
    id: "cst_sprint_graphs",
    slug: "night-sprint-graphs",
    title: "Night Sprint: Graphs Only",
    format: "sprint",
    season: "Season 04",
    state: "finished",
    summary: "Four graph problems, two hours, unrated. Editorial written collectively afterwards.",
    description:
      "An unrated practice sprint aimed at people who freeze on graph problems. No penalties, so submit early and often. Afterwards the room writes one shared editorial: everybody contributes the part they solved, including the part they solved badly.",
    rules: [
      "Unrated. Nothing here moves your season rating.",
      "No penalty for rejected submissions.",
      "Asking for a hint in the channel is allowed after the first hour.",
      "Everyone who solved a problem writes two paragraphs about it.",
    ],
    starts_at: days(-5, 20, 0),
    ends_at: days(-5, 22, 0),
    duration_minutes: 120,
    rated: false,
    registered_count: 96,
    problem_count: 4,
    registered: true,
    editorial_url: "https://notes.ccc.dev/editorials/sprint-graphs",
    problems: [
      {
        index: "A",
        problem_slug: "shortest-detour",
        title: "Shortest Detour",
        difficulty: "medium",
        points: 300,
        solved_by_count: 64,
        member_result: "solved",
      },
      {
        index: "B",
        problem_slug: "count-the-honest-streaks",
        title: "Count the Honest Streaks",
        difficulty: "easy",
        points: 150,
        solved_by_count: 88,
        member_result: "solved",
      },
      {
        index: "C",
        problem_slug: "rate-limit-under-a-thundering-herd",
        title: "Rate Limit Under a Thundering Herd",
        difficulty: "medium",
        points: 400,
        solved_by_count: 38,
        member_result: "attempted",
      },
      {
        index: "D",
        problem_slug: "break-the-cache",
        title: "Break the Cache",
        difficulty: "hard",
        points: 700,
        solved_by_count: 4,
        member_result: "untouched",
      },
    ],
    standings: standingsFor([1, 4, 10, 0, 2, 6, 3, 8, 5, 9], 5),
  },
  {
    id: "cst_ladder_13",
    slug: "pressure-ladder-13",
    title: "Pressure Ladder #13",
    format: "ladder",
    season: "Season 04",
    state: "finished",
    summary: "The previous rated ladder. Two problems went unsolved by the entire room.",
    description:
      "Notable mostly for problem E, which nobody solved, and problem C, which everybody solved in under nine minutes. The gap between those two is the reason the difficulty curve was rewritten for #14.",
    rules: [
      "Individual, rated, ICPC penalties.",
      "Scoreboard froze at the 75-minute mark.",
      "Two problems were left unsolved by the full field.",
    ],
    starts_at: days(-16, 20, 0),
    ends_at: days(-16, 21, 30),
    duration_minutes: 90,
    rated: true,
    registered_count: 128,
    problem_count: 5,
    registered: true,
    editorial_url: "https://notes.ccc.dev/editorials/ladder-13",
    problems: [
      {
        index: "A",
        problem_slug: "count-the-honest-streaks",
        title: "Count the Honest Streaks",
        difficulty: "easy",
        points: 100,
        solved_by_count: 121,
        member_result: "solved",
      },
      {
        index: "B",
        problem_slug: "parse-something-hostile",
        title: "Parse Something Hostile",
        difficulty: "easy",
        points: 200,
        solved_by_count: 97,
        member_result: "solved",
      },
      {
        index: "C",
        problem_slug: "shortest-detour",
        title: "Shortest Detour",
        difficulty: "medium",
        points: 400,
        solved_by_count: 55,
        member_result: "solved",
      },
      {
        index: "D",
        problem_slug: "break-the-cache",
        title: "Break the Cache",
        difficulty: "hard",
        points: 800,
        solved_by_count: 2,
        member_result: "attempted",
      },
      {
        index: "E",
        problem_slug: "replay-a-torn-log",
        title: "Replay a Torn Log",
        difficulty: "hard",
        points: 1000,
        solved_by_count: 0,
        member_result: "attempted",
      },
    ],
    standings: standingsFor([4, 1, 0, 10, 3, 2, 7, 5, 8, 6, 9], 2),
  },
];

const ratings = [2184, 2103, 2061, 1974, 1902, 1855, 1790, 1712, 1668, 1590, 1544, 1210];

export const leaderboard: LeaderboardRow[] = [1, 4, 0, 10, 2, 6, 3, 8, 5, 9, 7, 11].map(
  (rosterIndex, i) => {
    const m = roster[rosterIndex]!;
    return {
      rank: i + 1,
      previous_rank: i === 0 ? 2 : i === 1 ? 1 : i === 2 ? 5 : i % 3 === 0 ? i : i + 2,
      member_id: m.id,
      handle: m.handle,
      full_name: m.name,
      year: m.year,
      branch: m.branch,
      rating: ratings[i]!,
      problems_solved: 128 - i * 9,
      contests_played: 24 - i,
      contributions: 41 - i * 3,
      streak_days: [22, 18, 9, 31, 7, 12, 5, 14, 3, 6, 2, 1][i]!,
      is_you: m.id === member.id,
    };
  },
);

/** How the same board looks to a member who has not competed yet. */
export const rookieLeaderboard: LeaderboardRow[] = leaderboard
  .filter((r) => (r.year ?? 9) <= 2)
  .map((r, i) => ({ ...r, rank: i + 1, previous_rank: null }));
