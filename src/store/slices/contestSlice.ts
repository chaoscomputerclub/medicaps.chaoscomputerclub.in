import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { contestApi } from "@/features/contest/api";
import type {
  ContestSummary,
  RegistrationStatus,
  CampusPass,
  ContestProblemPreview,
  ContestArenaData,
  ArenaRunResult,
  ArenaSubmitResult,
} from "@/features/contest/types";

export interface ContestState {
  contests: ContestSummary[];
  currentContest: ContestSummary | null;
  registration: RegistrationStatus | null;
  pass: CampusPass | null;
  problems: ContestProblemPreview[];
  arenaData: ContestArenaData | null;
  runResult: ArenaRunResult | null;
  submitResult: ArenaSubmitResult | null;
  isLoading: boolean;
  isLoadingDetail: boolean;
  isLoadingArena: boolean;
  isRunningCode: boolean;
  isSubmittingCode: boolean;
  error: string | null;
}

const initialState: ContestState = {
  contests: [],
  currentContest: null,
  registration: null,
  pass: null,
  problems: [],
  arenaData: null,
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
  async (_, { rejectWithValue }) => {
    try {
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

export const registerContestThunk = createAsyncThunk(
  "contest/register",
  async (slug: string, { rejectWithValue }) => {
    try {
      const result = await contestApi.register(slug);
      const reg = await contestApi.registrationStatus(slug);
      return { result, registration: reg };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to register for contest");
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
      state.currentContest = action.payload.contest;
      state.registration = action.payload.registration;
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
      state.error = action.payload as string;
    });

    // Register
    builder.addCase(registerContestThunk.fulfilled, (state, action) => {
      state.registration = action.payload.registration;
      if (state.currentContest) {
        state.currentContest.registered = true;
        state.currentContest.registered_count += 1;
      }
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

export const { clearArenaResults, resetContestState } = contestSlice.actions;
export default contestSlice.reducer;
