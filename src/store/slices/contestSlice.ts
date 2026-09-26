import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { contestApi } from "@/features/contest/api";
import { globalSwrStore } from "@/lib/cache/swrCache";
import type {
  ContestSummary,
  RegistrationStatus,
  CampusPass,
  ContestProblemPreview,
  ContestArenaData,
  ArenaRunResult,
  ArenaSubmitResult,
  ParticipationRecord,
} from "@/features/contest/types";
import type { RealtimeEvent } from "@/lib/realtime";

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

export const registerContestThunk = createAsyncThunk(
  "contest/register",
  async (slug: string, { rejectWithValue }) => {
    try {
      const result = await contestApi.register(slug);
      const reg = await contestApi.registrationStatus(slug, true);
      const myParticipated = await contestApi.participated(true).catch(() => null);
      return { result, registration: reg, myParticipated, slug };
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
      const reg = await contestApi.registrationStatus(slug, true);
      const myParticipated = await contestApi.participated(true).catch(() => null);
      return { result, registration: reg, myParticipated, slug };
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
          if (isCurrentMember) {
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
          if (isCurrentMember) {
            if (targetContest) targetContest.registered = false;
            if (state.currentContest && state.currentContest.slug === slug) {
              state.currentContest.registered = false;
              if (state.registration) {
                state.registration.registered = false;
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
        case "pass_checked_in": {
          if (isCurrentMember) {
            if (state.pass) {
              state.pass.status = "checked_in";
              state.pass.check_in_status = "checked_in";
              if (event.data?.seat_number) {
                state.pass.seat = event.data.seat_number;
                state.pass.seat_number = event.data.seat_number;
              }
            }
            if (state.arenaData && event.data?.seat_number) {
              state.arenaData.assigned_seat = event.data.seat_number;
              state.arenaData.check_in_status = "checked_in";
            }
          }
          break;
        }
        case "top30_qualified": {
          if (isCurrentMember && state.registration) {
            state.registration.is_top_30_qualified = true;
            state.registration.can_enter_live_contest = true;
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
      state.contests = action.payload;
    });
    builder.addCase(fetchContestsThunk.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });

    // Detail
    builder.addCase(fetchContestDetailThunk.pending, (state) => {
      if (!state.currentContest) {
        state.isLoadingDetail = true;
      }
    });
    builder.addCase(fetchContestDetailThunk.fulfilled, (state, action) => {
      state.isLoadingDetail = false;
      const contest = action.payload.contest ? { ...action.payload.contest } : null;
      const registration = action.payload.registration;
      if (registration && contest) {
        contest.registered = registration.registered;
      }
      state.currentContest = contest;
      state.registration = registration;
      state.problems = action.payload.problems;
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
      state.arenaData = action.payload;
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
      state.registeringSlugs[slug] = false;
      state.registration = action.payload.registration;
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
      state.registeringSlugs[slug] = false;
      state.registration =
        action.payload.registration ?? (state.registration ? { ...state.registration, registered: false } : null);
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
export default contestSlice.reducer;
