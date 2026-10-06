import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { contestApi } from "@/features/contest/api";
import { globalSwrStore } from "@/lib/cache/swrCache";
import type {
  ContestSummary,
  RegistrationStatus,
  ContestProblemPreview,
  ContestArenaData,
  ArenaRunResult,
  ArenaSubmitResult,
  ParticipationRecord,
  CampusPass,
} from "@/features/contest/types";
import type { RealtimeEvent } from "@/lib/realtime";
import { sanitizeCodeSnippet } from "@/lib/utils";

export interface CanonicalRegistration {
  contest_id?: number | string | null;
  contest_slug: string;
  member_id?: number | string | null;
  registered: boolean;
  status?: string | null;
  registered_at?: string | null;
  updated_at: number;
  version?: number;
}

export interface ContestState {
  contests: ContestSummary[];
  currentContest: ContestSummary | null;
  registration: RegistrationStatus | null;
  pass: CampusPass | null;
  problems: ContestProblemPreview[];
  arenaData: ContestArenaData | null;
  myParticipations: ParticipationRecord[];
  isLoadingParticipations: boolean;
  registeringSlugs: Record<string, boolean>;
  runResult: ArenaRunResult | null;
  submitResult: ArenaSubmitResult | null;
  isLoading: boolean;
  isLoadingDetail: boolean;
  isLoadingArena: boolean;
  isRunningCode: boolean;
  isSubmittingCode: boolean;
  error: string | null;
  activeDetailRequestId: string | null;
  activeDetailSlug: string | null;
  lastEventTimestamps: Record<string, number>;
  registrationsBySlug: Record<string, CanonicalRegistration>;
  detailRequestStartTimes: Record<string, number>;
}

function getInitialContests(): ContestSummary[] {
  if (typeof window !== "undefined") {
    try {
      const cached = globalSwrStore.get<ContestSummary[]>("contests:list");
      if (cached && Array.isArray(cached.data)) {
        return cached.data;
      }
    } catch {
      // ignore
    }
  }
  return [];
}

const initialState: ContestState = {
  contests: getInitialContests(),
  currentContest: null,
  registration: null,
  pass: null,
  problems: [],
  arenaData: null,
  myParticipations: [],
  isLoadingParticipations: false,
  registeringSlugs: {},
  runResult: null,
  submitResult: null,
  isLoading: false,
  isLoadingDetail: false,
  isLoadingArena: false,
  isRunningCode: false,
  isSubmittingCode: false,
  error: null,
  activeDetailRequestId: null,
  activeDetailSlug: null,
  lastEventTimestamps: {},
  registrationsBySlug: {},
  detailRequestStartTimes: {},
};

export const fetchContestsThunk = createAsyncThunk(
  "contest/fetchContests",
  async (force: boolean | undefined = false, { rejectWithValue }) => {
    try {
      return await contestApi.list(Boolean(force));
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to load contests");
    }
  }
);

export const fetchContestDetailThunk = createAsyncThunk(
  "contest/fetchDetail",
  async (arg: string | { slug: string; force?: boolean }, { rejectWithValue }) => {
    const slug = typeof arg === "string" ? arg : arg.slug;
    const force = typeof arg === "object" ? Boolean(arg.force) : false;
    try {
      const [contest, registration, problems] = await Promise.all([
        contestApi.detail(slug, force),
        contestApi.registrationStatus(slug, force).catch(() => null),
        contestApi.problems(slug, force).catch(() => []),
      ]);
      return { contest, registration, problems };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to load contest details");
    }
  }
);

export const fetchCampusPassThunk = createAsyncThunk(
  "contest/fetchPass",
  async (contestSlug: string | undefined, { rejectWithValue }) => {
    try {
      if (contestSlug) {
        const pass = await contestApi.contestPass(contestSlug);
        if (pass) return pass;
      }
      return await contestApi.myPass();
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to load campus pass");
    }
  }
);

export const fetchContestArenaThunk = createAsyncThunk(
  "contest/fetchArena",
  async (slug: string, { rejectWithValue }) => {
    try {
      return await contestApi.arena(slug);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to load contest arena");
    }
  }
);

export const fetchMyParticipationsThunk = createAsyncThunk(
  "contest/fetchMyParticipations",
  async (force: boolean | undefined = false, { rejectWithValue }) => {
    try {
      return await contestApi.participated(Boolean(force));
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to load participation history");
    }
  }
);

// Fence window: canonical mutations carry updated_at biased this many ms into the future,
// so any detail fetch triggered immediately after a mutation is correctly treated as "older"
// than the canonical and does NOT overwrite the authoritative local state.
const MUTATION_FENCE_MS = 10_000; // 10 seconds

export const registerContestThunk = createAsyncThunk(
  "contest/register",
  async (slug: string, { rejectWithValue }) => {
    try {
      // contestApi.register() already invalidates all SWR caches and seeds contest:reg_status:{slug}
      // synchronously. Re-fetching registrationStatus(force=true) here would race against the
      // simultaneous refreshDetail(true) call on ContestOverviewPage and could produce stale reads.
      const result = await contestApi.register(slug);
      // Build a canonical registration from the mutation response directly (no extra round-trip).
      const canonicalReg = {
        registered: true,
        contest_slug: slug,
        status: (result as any).status || "confirmed",
        registered_at: (result as any).registered_at || new Date().toISOString(),
        contest_status: null,
        assessment_taken: false,
        assessment_score: null,
        assessment_rank: null,
        assessment_status: null,
        is_top_30_qualified: true,
        can_take_assessment: false,
        can_resume_assessment: false,
        can_enter_live_contest: false,
        eligibility_message: null,
        is_dev_bypass: false,
        remaining_seconds: null,
        anti_cheat_violations: 0,
        max_violations: 3,
      };
      const myParticipated = await contestApi.participated(true).catch(() => null);
      return { result, registration: canonicalReg, myParticipated, slug };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to register for contest");
    }
  }
);

export const unregisterContestThunk = createAsyncThunk(
  "contest/unregister",
  async (slug: string, { rejectWithValue }) => {
    try {
      const result = await contestApi.unregister(slug);
      // Derive unregistered state from mutation response directly, same pattern as register.
      const canonicalReg = {
        registered: false,
        contest_slug: slug,
        status: "unregistered" as const,
        registered_at: null,
        contest_status: null,
        assessment_taken: false,
        assessment_score: null,
        assessment_rank: null,
        assessment_status: null,
        is_top_30_qualified: false,
        can_take_assessment: false,
        can_resume_assessment: false,
        can_enter_live_contest: false,
        eligibility_message: null,
        is_dev_bypass: false,
        remaining_seconds: null,
        anti_cheat_violations: 0,
        max_violations: 3,
      };
      const myParticipated = await contestApi.participated(true).catch(() => null);
      return { result, registration: canonicalReg, myParticipated, slug };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to unregister from contest");
    }
  }
);

export const checkInContestThunk = createAsyncThunk(
  "contest/checkIn",
  async (slug: string, { rejectWithValue }) => {
    try {
      const res = await contestApi.checkIn(slug);
      const updatedPass = await contestApi.myPass();
      return { message: res.message, pass: updatedPass };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to check in");
    }
  }
);

export const runArenaCodeThunk = createAsyncThunk(
  "contest/runArenaCode",
  async (
    { slug, payload }: { slug: string; payload: Parameters<typeof contestApi.runArenaCode>[1] },
    { rejectWithValue }
  ) => {
    try {
      return await contestApi.runArenaCode(slug, payload);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to execute code");
    }
  }
);

export const submitArenaCodeThunk = createAsyncThunk(
  "contest/submitArenaCode",
  async (
    { slug, payload }: { slug: string; payload: Parameters<typeof contestApi.submitArenaCode>[1] },
    { rejectWithValue }
  ) => {
    try {
      return await contestApi.submitArenaCode(slug, payload);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to submit code");
    }
  }
);

export const contestSlice = createSlice({
  name: "contest",
  initialState,
  reducers: {
    clearArenaResults(state) {
      state.runResult = null;
      state.submitResult = null;
    },
    resetContestState(state) {
      state.currentContest = null;
      state.registration = null;
      state.problems = [];
      state.arenaData = null;
      state.runResult = null;
      state.submitResult = null;
    },
    removeContestFromState(state, action: PayloadAction<string>) {
      const contestSlug = action.payload;
      state.contests = state.contests.filter((contest) => contest.slug !== contestSlug);
      state.myParticipations = state.myParticipations.filter((p) => p.contest_slug !== contestSlug);
      if (state.currentContest?.slug === contestSlug) {
        state.currentContest = null;
        state.registration = null;
        state.pass = null;
        state.problems = [];
        state.arenaData = null;
        state.runResult = null;
        state.submitResult = null;
      }
    },
    applyRealtimeEvent(
      state,
      action: PayloadAction<{
        event: RealtimeEvent;
        currentMember?: { id?: string | number; handle?: string | null } | null;
      }>
    ) {
      const { event, currentMember } = action.payload;
      const slug = event.contest_slug ?? event.data?.contest_slug;

      // Event ordering & version fencing: drop out-of-order stale SSE events
      const eventTime = event.timestamp ? new Date(event.timestamp).getTime() : 0;
      if (slug && eventTime > 0) {
        const lastTime = state.lastEventTimestamps?.[slug] || 0;
        if (eventTime < lastTime) {
          return;
        }
        if (!state.lastEventTimestamps) state.lastEventTimestamps = {};
        state.lastEventTimestamps[slug] = eventTime;
      }

      const isCurrentMember = Boolean(
        currentMember &&
          ((event.data?.member_id && String(event.data.member_id) === String(currentMember.id)) ||
            (event.data?.handle &&
              currentMember.handle &&
              String(event.data.handle).toLowerCase() === currentMember.handle.toLowerCase()))
      );

      switch (event.event) {
        case "contest_registered": {
          const regCount = event.data?.registered_count;
          const targetContest = state.contests.find((c) => c.slug === slug);
          if (targetContest && typeof regCount === "number") {
            targetContest.registered_count = regCount;
          }
          if (state.currentContest && state.currentContest.slug === slug && typeof regCount === "number") {
            state.currentContest.registered_count = regCount;
          }
          if (isCurrentMember && slug) {
            const eventTimestamp = eventTime || Date.now();
            if (!state.registrationsBySlug) state.registrationsBySlug = {};
            const existing = state.registrationsBySlug[slug];
            if (!existing || eventTimestamp >= existing.updated_at) {
              state.registrationsBySlug[slug] = {
                contest_id: event.data?.contest_id,
                contest_slug: slug,
                member_id: event.data?.member_id ?? currentMember?.id,
                registered: true,
                status: event.data?.status || "confirmed",
                registered_at: event.data?.registered_at || new Date().toISOString(),
                updated_at: eventTimestamp,
                version: event.data?.version,
              };
            }
            if (targetContest) targetContest.registered = true;
            if (state.currentContest && state.currentContest.slug === slug) {
              state.currentContest.registered = true;
              if (state.registration) {
                state.registration.registered = true;
                state.registration.status = "confirmed";
              }
            }
          }
          break;
        }
        case "contest_unregistered": {
          const regCount = event.data?.registered_count;
          const targetContest = state.contests.find((c) => c.slug === slug);
          if (targetContest && typeof regCount === "number") {
            targetContest.registered_count = regCount;
          }
          if (state.currentContest && state.currentContest.slug === slug && typeof regCount === "number") {
            state.currentContest.registered_count = regCount;
          }
          if (isCurrentMember && slug) {
            const eventTimestamp = eventTime || Date.now();
            if (!state.registrationsBySlug) state.registrationsBySlug = {};
            const existing = state.registrationsBySlug[slug];
            if (!existing || eventTimestamp >= existing.updated_at) {
              state.registrationsBySlug[slug] = {
                contest_id: event.data?.contest_id,
                contest_slug: slug,
                member_id: event.data?.member_id ?? currentMember?.id,
                registered: false,
                status: "unregistered",
                registered_at: null,
                updated_at: eventTimestamp,
                version: event.data?.version,
              };
            }
            if (targetContest) targetContest.registered = false;
            if (state.currentContest && state.currentContest.slug === slug) {
              state.currentContest.registered = false;
              if (state.registration) {
                state.registration.registered = false;
                state.registration.status = "unregistered";
              }
            }
            state.myParticipations = state.myParticipations.filter((p) => p.contest_slug !== slug);
          }
          break;
        }
        case "contest_status_changed":
        case "contest_concluded":
        case "contest_finished": {
          const newStatus =
            event.event === "contest_concluded" || event.event === "contest_finished"
              ? "finished"
              : (event.data?.new_status ?? event.data?.status ?? "upcoming");
          const targetContest = state.contests.find((c) => c.slug === slug);
          if (targetContest) targetContest.status = newStatus;
          if (state.currentContest && state.currentContest.slug === slug) {
            state.currentContest.status = newStatus;
          }
          const partRecord = state.myParticipations.find((p) => p.contest_slug === slug);
          if (partRecord) partRecord.status = newStatus;
          break;
        }
        case "contest_timer_reset": {
          const startsAt = event.data?.starts_at;
          if (startsAt) {
            const targetContest = state.contests.find((c) => c.slug === slug);
            if (targetContest) {
              targetContest.starts_at = startsAt;
              targetContest.status = "upcoming";
            }
            if (state.currentContest && state.currentContest.slug === slug) {
              state.currentContest.starts_at = startsAt;
              state.currentContest.status = "upcoming";
            }
          }
          break;
        }
        case "contest_updated": {
          const targetContest = state.contests.find((c) => c.slug === slug);
          if (targetContest && event.data) {
            if (event.data.contest_title) targetContest.title = event.data.contest_title;
            if (event.data.status) targetContest.status = event.data.status;
            if (event.data.starts_at) targetContest.starts_at = event.data.starts_at;
            if (event.data.ends_at) targetContest.ends_at = event.data.ends_at;
            if (typeof event.data.registered_count === "number") {
              targetContest.registered_count = event.data.registered_count;
            }
          }
          if (state.currentContest && state.currentContest.slug === slug && event.data) {
            if (event.data.contest_title) state.currentContest.title = event.data.contest_title;
            if (event.data.status) state.currentContest.status = event.data.status;
            if (event.data.starts_at) state.currentContest.starts_at = event.data.starts_at;
            if (event.data.ends_at) state.currentContest.ends_at = event.data.ends_at;
            if (typeof event.data.registered_count === "number") {
              state.currentContest.registered_count = event.data.registered_count;
            }
          }
          break;
        }
        case "contest_deleted": {
          state.contests = state.contests.filter((c) => c.slug !== slug);
          state.myParticipations = state.myParticipations.filter((p) => p.contest_slug !== slug);
          if (state.currentContest?.slug === slug) {
            state.currentContest = null;
            state.registration = null;
            state.pass = null;
            state.problems = [];
            state.arenaData = null;
          }
          break;
        }
      }
    },
  },
  extraReducers: (builder) => {
    // List
    builder.addCase(fetchContestsThunk.pending, (state) => {
      if (state.contests.length === 0) {
        state.isLoading = true;
      }
      state.error = null;
    });
    builder.addCase(fetchContestsThunk.fulfilled, (state, action: PayloadAction<ContestSummary[]>) => {
      state.isLoading = false;
      const list = action.payload || [];
      if (!state.registrationsBySlug) state.registrationsBySlug = {};
      state.contests = list.map((c) => {
        const canonical = state.registrationsBySlug[c.slug];
        if (canonical) {
          return { ...c, registered: canonical.registered };
        }
        if (c.registered) {
          state.registrationsBySlug[c.slug] = {
            contest_slug: c.slug,
            registered: true,
            status: "confirmed",
            updated_at: Date.now(),
          };
        }
        return { ...c };
      });
    });
    builder.addCase(fetchContestsThunk.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });

    // Detail
    builder.addCase(fetchContestDetailThunk.pending, (state, action) => {
      const slug = typeof action.meta.arg === "string" ? action.meta.arg : action.meta.arg.slug;
      if (!state.currentContest || state.currentContest.slug !== slug) {
        state.isLoadingDetail = true;
      }
      state.activeDetailRequestId = action.meta.requestId;
      state.activeDetailSlug = slug;
      if (!state.detailRequestStartTimes) state.detailRequestStartTimes = {};
      state.detailRequestStartTimes[slug] = Date.now();
    });
    builder.addCase(fetchContestDetailThunk.fulfilled, (state, action) => {
      state.isLoadingDetail = false;
      const slug = typeof action.meta.arg === "string" ? action.meta.arg : action.meta.arg.slug;
      const contest = action.payload.contest ? { ...action.payload.contest } : null;
      let registration = action.payload.registration ? { ...action.payload.registration } : null;

      const requestStart = state.detailRequestStartTimes?.[slug] || 0;
      const canonical = state.registrationsBySlug?.[slug];

      // Timestamp fencing: If a newer local mutation or SSE event was applied after this GET started,
      // preserve the newer authoritative state rather than being overwritten by a stale GET response!
      if (canonical && canonical.updated_at > requestStart) {
        if (contest) contest.registered = canonical.registered;
        if (registration) {
          registration.registered = canonical.registered;
          if (canonical.status) registration.status = canonical.status;
        }
      } else {
        const isReg =
          registration !== null && registration !== undefined
            ? Boolean(registration.registered)
            : Boolean(contest?.registered);
        if (!state.registrationsBySlug) state.registrationsBySlug = {};
        state.registrationsBySlug[slug] = {
          contest_slug: slug,
          registered: isReg,
          status: registration?.status || (isReg ? "confirmed" : null),
          registered_at: registration?.registered_at || null,
          updated_at: Date.now(),
        };
        if (registration && contest) {
          contest.registered = registration.registered;
        }
      }

      state.currentContest = contest;
      state.registration = registration;
      const rawProblems = action.payload.problems || [];
      state.problems = rawProblems.map((p: any) => {
        if (!p || !p.starter_codes || typeof p.starter_codes !== "object") return p;
        const cleaned: Record<string, string> = {};
        for (const [lang, code] of Object.entries(p.starter_codes)) {
          cleaned[lang] = sanitizeCodeSnippet(code as string);
        }
        return { ...p, starter_codes: cleaned };
      });
    });
    builder.addCase(fetchContestDetailThunk.rejected, (state, action) => {
      state.isLoadingDetail = false;
      state.error = action.payload as string;
    });

    // Pass
    builder.addCase(fetchCampusPassThunk.fulfilled, (state, action) => {
      state.pass = action.payload;
    });

    // Arena
    builder.addCase(fetchContestArenaThunk.pending, (state) => {
      state.isLoadingArena = true;
      state.error = null;
    });
    builder.addCase(fetchContestArenaThunk.fulfilled, (state, action) => {
      state.isLoadingArena = false;
      const arena = action.payload;
      if (arena && Array.isArray(arena.problems)) {
        arena.problems = arena.problems.map((p: any) => {
          if (!p || !p.starter_codes || typeof p.starter_codes !== "object") return p;
          const cleaned: Record<string, string> = {};
          for (const [lang, code] of Object.entries(p.starter_codes)) {
            cleaned[lang] = sanitizeCodeSnippet(code as string);
          }
          return { ...p, starter_codes: cleaned };
        });
      }
      state.arenaData = arena;
    });
    builder.addCase(fetchContestArenaThunk.rejected, (state, action) => {
      state.isLoadingArena = false;
      state.arenaData = null;
      state.error = action.payload as string;
    });

    // My Participations
    builder.addCase(fetchMyParticipationsThunk.pending, (state) => {
      state.isLoadingParticipations = true;
    });
    builder.addCase(fetchMyParticipationsThunk.fulfilled, (state, action) => {
      state.isLoadingParticipations = false;
      state.myParticipations = action.payload || [];
    });
    builder.addCase(fetchMyParticipationsThunk.rejected, (state) => {
      state.isLoadingParticipations = false;
    });

    // Register
    builder.addCase(registerContestThunk.pending, (state, action) => {
      state.registeringSlugs[action.meta.arg] = true;
    });
    builder.addCase(registerContestThunk.fulfilled, (state, action) => {
      const slug = action.payload.slug;
      // Future-bias the updated_at by MUTATION_FENCE_MS so that any detail fetch triggered
      // immediately after (requestStart ≈ now) sees canonical.updated_at > requestStart and
      // correctly preserves the mutation result rather than overwriting it.
      const fencedNow = Date.now() + MUTATION_FENCE_MS;
      state.registeringSlugs[slug] = false;
      state.registration = action.payload.registration as any;

      if (!state.registrationsBySlug) state.registrationsBySlug = {};
      state.registrationsBySlug[slug] = {
        contest_slug: slug,
        registered: true,
        status: (action.payload.registration as any)?.status || "confirmed",
        registered_at: (action.payload.registration as any)?.registered_at || new Date().toISOString(),
        updated_at: fencedNow,
      };

      if (state.currentContest && state.currentContest.slug === slug) {
        state.currentContest.registered = true;
        state.currentContest.registered_count =
          (action.payload.result as any)?.registered_count ?? (state.currentContest.registered_count + 1);
      }
      const contestInList = state.contests.find((c) => c.slug === slug);
      if (contestInList) {
        contestInList.registered = true;
        contestInList.registered_count =
          (action.payload.result as any)?.registered_count ?? (contestInList.registered_count + 1);
      }
      if (action.payload.myParticipated) {
        state.myParticipations = action.payload.myParticipated;
      }
    });
    builder.addCase(registerContestThunk.rejected, (state, action) => {
      state.registeringSlugs[action.meta.arg] = false;
    });

    // Unregister
    builder.addCase(unregisterContestThunk.pending, (state, action) => {
      state.registeringSlugs[action.meta.arg] = true;
    });
    builder.addCase(unregisterContestThunk.fulfilled, (state, action) => {
      const slug = action.payload.slug;
      const fencedNow = Date.now() + MUTATION_FENCE_MS;
      state.registeringSlugs[slug] = false;
      state.registration =
        (action.payload.registration as any) ?? (state.registration ? { ...state.registration, registered: false } : null);

      if (!state.registrationsBySlug) state.registrationsBySlug = {};
      state.registrationsBySlug[slug] = {
        contest_slug: slug,
        registered: false,
        status: "unregistered",
        registered_at: null,
        updated_at: fencedNow,
      };

      if (state.currentContest && state.currentContest.slug === slug) {
        state.currentContest.registered = false;
        state.currentContest.registered_count =
          (action.payload.result as any)?.registered_count ??
          Math.max(0, state.currentContest.registered_count - 1);
      }
      const contestInList = state.contests.find((c) => c.slug === slug);
      if (contestInList) {
        contestInList.registered = false;
        contestInList.registered_count =
          (action.payload.result as any)?.registered_count ??
          Math.max(0, contestInList.registered_count - 1);
      }
      if (action.payload.myParticipated) {
        state.myParticipations = action.payload.myParticipated;
      } else {
        state.myParticipations = state.myParticipations.filter((p) => p.contest_slug !== slug);
      }
    });
    builder.addCase(unregisterContestThunk.rejected, (state, action) => {
      state.registeringSlugs[action.meta.arg] = false;
    });

    // CheckIn
    builder.addCase(checkInContestThunk.fulfilled, (state, action) => {
      if (action.payload.pass) {
        state.pass = action.payload.pass;
      }
    });

    // Run Code
    builder.addCase(runArenaCodeThunk.pending, (state) => {
      state.isRunningCode = true;
    });
    builder.addCase(runArenaCodeThunk.fulfilled, (state, action) => {
      state.isRunningCode = false;
      state.runResult = action.payload;
    });
    builder.addCase(runArenaCodeThunk.rejected, (state) => {
      state.isRunningCode = false;
    });

    // Submit Code
    builder.addCase(submitArenaCodeThunk.pending, (state) => {
      state.isSubmittingCode = true;
    });
    builder.addCase(submitArenaCodeThunk.fulfilled, (state, action) => {
      state.isSubmittingCode = false;
      state.submitResult = action.payload;
    });
    builder.addCase(submitArenaCodeThunk.rejected, (state) => {
      state.isSubmittingCode = false;
    });
  },
});

export const { clearArenaResults, resetContestState, removeContestFromState, applyRealtimeEvent } =
  contestSlice.actions;

export const selectContestRegistration = (
  state: { contest: ContestState },
  slug: string
): CanonicalRegistration | null => {
  return state.contest.registrationsBySlug?.[slug] ?? null;
};

export const selectIsContestRegistered = (
  state: { contest: ContestState },
  slug: string
): boolean => {
  if (!slug) return false;
  const canonical = state.contest.registrationsBySlug?.[slug];
  if (canonical !== undefined && canonical !== null) {
    return Boolean(canonical.registered);
  }
  if (state.contest.currentContest?.slug === slug && state.contest.currentContest.registered !== undefined) {
    return Boolean(state.contest.currentContest.registered);
  }
  const inList = state.contest.contests.find((c) => c.slug === slug);
  if (inList && inList.registered !== undefined) {
    return Boolean(inList.registered);
  }
  const inPart = state.contest.myParticipations.find((p) => p.contest_slug === slug);
  if (inPart) {
    return true;
  }
  if (state.contest.registration?.contest_slug === slug && state.contest.registration.registered !== undefined) {
    return Boolean(state.contest.registration.registered);
  }
  return false;
};

export default contestSlice.reducer;
