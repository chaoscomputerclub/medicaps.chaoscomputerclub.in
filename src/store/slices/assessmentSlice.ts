import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchAssessmentData,
  runAssessmentCode,
  submitAssessmentCode,
  sendAssessmentTelemetry,
  finishAssessmentTest,
} from "@/lib/auth";
import { invalidateSwrCache } from "@/lib/cache/swrCache";

export interface AssessmentProblemData {
  id: string;
  problem_index: string;
  title: string;
  difficulty: string;
  description: string;
  input_format: string | null;
  output_format: string | null;
  constraints: string | null;
  points: number;
  time_limit: number;
  memory_limit: number;
  starter_codes: Record<string, string>;
  sample_testcases: Array<{
    stdin: string;
    expected_output: string;
    explanation?: string;
  }>;
}

export interface AssessmentState {
  contestSlug: string | null;
  assessment: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    duration_minutes: number;
    max_violations: number;
    starts_at?: string;
    ends_at?: string;
    is_open?: boolean;
    opens_in_seconds?: number;
    closes_in_seconds?: number;
  } | null;
  session: {
    id: string;
    status: string;
    started_at: string;
    remaining_seconds: number;
    total_score: number;
    anti_cheat_violations: number;
    is_top_30_qualified: boolean;
    is_resumed?: boolean;
  } | null;
  problems: AssessmentProblemData[];
  activeProblemIndex: number;
  selectedLanguage: "python" | "cpp" | "javascript";
  codeMap: Record<string, string>;
  customStdin: string;
  activeConsoleTab: "testcases" | "output";
  isRunning: boolean;
  isSubmitting: boolean;
  runResult: any | null;
  submitResult: any | null;
  submissionsMap: Record<string, any>;
  antiCheatWarningOpen: boolean;
  antiCheatWarningMessage: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AssessmentState = {
  contestSlug: null,
  assessment: null,
  session: null,
  problems: [],
  activeProblemIndex: 0,
  selectedLanguage: "python",
  codeMap: {},
  customStdin: "",
  activeConsoleTab: "testcases",
  isRunning: false,
  isSubmitting: false,
  runResult: null,
  submitResult: null,
  submissionsMap: {},
  antiCheatWarningOpen: false,
  antiCheatWarningMessage: null,
  isLoading: false,
  error: null,
};

// ── Async Thunks ─────────────────────────────────────────────────────────────

export const fetchAssessmentThunk = createAsyncThunk<any, string, { rejectValue: string }>(
  "assessment/fetch",
  async (contestSlug, { rejectWithValue }) => {
    try {
      return await fetchAssessmentData(contestSlug);
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to load assessment.");
    }
  },
);

export const runCodeThunk = createAsyncThunk<
  any,
  { contestSlug: string; problemId: string; language: string; code: string; customStdin?: string },
  { rejectValue: string }
>(
  "assessment/runCode",
  async ({ contestSlug, problemId, language, code, customStdin }, { rejectWithValue }) => {
    try {
      return await runAssessmentCode(contestSlug, {
        problem_id: problemId,
        language,
        code,
        ...(customStdin ? { custom_stdin: customStdin } : {}),
      });
    } catch (err: any) {
      return rejectWithValue(err?.message || "Execution failed.");
    }
  },
);

export const submitCodeThunk = createAsyncThunk<
  any,
  { contestSlug: string; problemId: string; language: string; code: string },
  { rejectValue: string }
>(
  "assessment/submitCode",
  async ({ contestSlug, problemId, language, code }, { rejectWithValue }) => {
    try {
      return await submitAssessmentCode(contestSlug, {
        problem_id: problemId,
        language,
        code,
      });
    } catch (err: any) {
      return rejectWithValue(err?.message || "Submission evaluation failed.");
    }
  },
);

export const reportTelemetryThunk = createAsyncThunk<
  any,
  { contestSlug: string; eventType: string },
  { rejectValue: string }
>("assessment/reportTelemetry", async ({ contestSlug, eventType }, { rejectWithValue }) => {
  try {
    return await sendAssessmentTelemetry(contestSlug, eventType);
  } catch (err: any) {
    return rejectWithValue(err?.message || "Telemetry sync failed.");
  }
});

export const finishAssessmentThunk = createAsyncThunk<any, string, { rejectValue: string }>(
  "assessment/finish",
  async (contestSlug, { rejectWithValue }) => {
    try {
      return await finishAssessmentTest(contestSlug);
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to finalize assessment.");
    }
  },
);

export const assessmentSlice = createSlice({
  name: "assessment",
  initialState,
  reducers: {
    setActiveProblemIndex(state, action: PayloadAction<number>) {
      state.activeProblemIndex = action.payload;
      state.runResult = null;
      state.submitResult = null;
    },
    setSelectedLanguage(state, action: PayloadAction<"python" | "cpp" | "javascript">) {
      state.selectedLanguage = action.payload;
    },
    setCode(state, action: PayloadAction<{ problemId: string; language: string; code: string }>) {
      const key = `${action.payload.problemId}_${action.payload.language}`;
      state.codeMap[key] = action.payload.code;
    },
    resetStarterCode(state) {
      const activeProb = state.problems[state.activeProblemIndex];
      if (activeProb && activeProb.starter_codes) {
        const lang = state.selectedLanguage;
        const starter = activeProb.starter_codes[lang] || "";
        const key = `${activeProb.id}_${lang}`;
        state.codeMap[key] = starter;
      }
    },
    setCustomStdin(state, action: PayloadAction<string>) {
      state.customStdin = action.payload;
    },
    setActiveConsoleTab(state, action: PayloadAction<"testcases" | "output">) {
      state.activeConsoleTab = action.payload;
    },
    decrementTimer(state) {
      if (state.session && state.session.remaining_seconds > 0) {
        state.session.remaining_seconds -= 1;
        if (state.session.remaining_seconds === 0) {
          state.session.status = "submitted";
          try {
            invalidateSwrCache("contests:*");
            invalidateSwrCache("contest:*");
            invalidateSwrCache("passes:*");
            invalidateSwrCache("portal:*");
            if (typeof window !== "undefined") {
              localStorage.setItem("ccc:assessment_updated", String(Date.now()));
              window.dispatchEvent(new CustomEvent("assessment:status_changed"));
            }
          } catch {}
        }
      }
    },
    dismissAntiCheatWarning(state) {
      state.antiCheatWarningOpen = false;
    },
  },
  extraReducers: (builder) => {
    // fetchAssessmentThunk
    builder.addCase(fetchAssessmentThunk.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchAssessmentThunk.fulfilled, (state, action) => {
      state.isLoading = false;
      state.assessment = action.payload.assessment;
      state.session = action.payload.session;
      state.problems = action.payload.problems;
      state.submissionsMap = action.payload.submissions || {};
      state.contestSlug = action.payload.assessment?.slug || null;

      // Detect session resumption after disconnect/power cut
      if (action.payload.session?.is_resumed && action.payload.session?.status === "in_progress") {
        const violations = action.payload.session.anti_cheat_violations || 1;
        const maxViolations = action.payload.assessment?.max_violations || 3;
        state.antiCheatWarningOpen = true;
        state.antiCheatWarningMessage = `Session Resumed · Warning ${violations} of ${maxViolations}: You left the assessment without finishing (sudden power cut or window exit detected). Your session has resumed. Timer continues from the server clock. Stay inside this window.`;
      }

      // Populate starter codes if codeMap is empty for problem
      for (const p of action.payload.problems) {
        const starters = p.starter_codes || {};
        for (const lang of ["python", "cpp", "javascript"]) {
          const key = `${p.id}_${lang}`;
          const current = state.codeMap[key];
          const isLegacy = current && (current.includes("TODO: Calculate valid mirror pairs") || current.includes("def main():") || (lang === "python" && !current.includes("class Solution")));
          if ((!current || isLegacy) && starters[lang]) {
            state.codeMap[key] = starters[lang];
          }
        }
      }
    });
    builder.addCase(fetchAssessmentThunk.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || "Could not load assessment.";
    });

    // runCodeThunk
    builder.addCase(runCodeThunk.pending, (state) => {
      state.isRunning = true;
      state.activeConsoleTab = "output";
      state.runResult = null;
    });
    builder.addCase(runCodeThunk.fulfilled, (state, action) => {
      state.isRunning = false;
      state.runResult = action.payload;
    });
    builder.addCase(runCodeThunk.rejected, (state, action) => {
      state.isRunning = false;
      state.runResult = {
        stdout: "",
        stderr: action.payload || "Code execution failed",
        exit_code: 1,
        execution_time_ms: 0,
      };
    });

    // submitCodeThunk
    builder.addCase(submitCodeThunk.pending, (state) => {
      state.isSubmitting = true;
      state.activeConsoleTab = "output";
      state.submitResult = null;
    });
    builder.addCase(submitCodeThunk.fulfilled, (state, action) => {
      state.isSubmitting = false;
      state.submitResult = action.payload;
      const prob = state.problems[state.activeProblemIndex];
      if (prob) {
        state.submissionsMap[prob.id] = action.payload;
      }
      if (state.session && typeof action.payload.score === "number") {
        // recalculate best score locally
        state.session.total_score = Object.values(state.submissionsMap).reduce(
          (acc: number, curr: any) => acc + (curr.score || 0),
          0,
        );
      }
    });
    builder.addCase(submitCodeThunk.rejected, (state, action) => {
      state.isSubmitting = false;
      state.submitResult = {
        verdict: "INTERNAL_ERROR",
        score: 0,
        stderr: action.payload || "Submission evaluation failed",
      };
    });

    // reportTelemetryThunk
    builder.addCase(reportTelemetryThunk.fulfilled, (state, action) => {
      if (state.session) {
        state.session.anti_cheat_violations = action.payload.violations;
        if (action.payload.is_disqualified) {
          state.session.status = "disqualified";
          try {
            invalidateSwrCache("contests:*");
            invalidateSwrCache("contest:*");
            invalidateSwrCache("passes:*");
            invalidateSwrCache("portal:*");
            if (typeof window !== "undefined") {
              localStorage.setItem("ccc:assessment_updated", String(Date.now()));
              window.dispatchEvent(new CustomEvent("assessment:status_changed"));
            }
          } catch {}
        }
      }
      state.antiCheatWarningOpen = true;
      state.antiCheatWarningMessage = action.payload.is_disqualified
        ? "Assessment disqualified: Maximum anti-cheat window focus violations exceeded."
        : `Focus loss detected! Warning ${action.payload.violations} of ${action.payload.max_violations}. Stay inside the assessment window.`;
    });

    // finishAssessmentThunk
    builder.addCase(finishAssessmentThunk.fulfilled, (state, action) => {
      if (state.session) {
        state.session.status = "submitted";
      }
      try {
        invalidateSwrCache("contests:*");
        invalidateSwrCache("contest:*");
        invalidateSwrCache("passes:*");
        invalidateSwrCache("portal:*");
        if (typeof window !== "undefined") {
          localStorage.setItem("ccc:assessment_updated", String(Date.now()));
          window.dispatchEvent(new CustomEvent("assessment:status_changed", { detail: action.payload }));
        }
      } catch {}
    });
  },
});

export const {
  setActiveProblemIndex,
  setSelectedLanguage,
  setCode,
  resetStarterCode,
  setCustomStdin,
  setActiveConsoleTab,
  decrementTimer,
  dismissAntiCheatWarning,
} = assessmentSlice.actions;

export default assessmentSlice.reducer;
