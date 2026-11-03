/**
 * Chaos Computer Club Medi-Caps — Redux Slice for AI Interview Practice
 */

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type {
  InterviewCategoryInfo,
  InterviewTrackSummary,
  InterviewSessionListItem,
  InterviewSessionDetail,
  InterviewConfigCreate,
  InterviewAnswerSubmit,
  InterviewReportDetail,
  CandidateProfile,
  ResumeDetailResponse,
  ResumeUploadResponse,
  ResumeFactItem,
  ResumeFactUpdateRequest,
  VoiceBindingResponse,
} from "@/features/interview/types";
import * as interviewApi from "@/features/interview/api";

export interface InterviewState {
  categories: InterviewCategoryInfo[];
  tracks: InterviewTrackSummary[];
  sessions: InterviewSessionListItem[];
  currentSession: InterviewSessionDetail | null;
  candidateProfile: CandidateProfile | null;
  currentResume: ResumeDetailResponse | null;
  voiceBinding: VoiceBindingResponse | null;
  isVoiceActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  interimTranscript: string;
  isLoading: boolean;
  isLoadingTracks: boolean;
  isSubmittingAnswer: boolean;
  isStartingSession: boolean;
  isUploadingResume: boolean;
  isRegeneratingReport: boolean;
  error: string | null;
  configModalOpen: boolean;
  resumeModalOpen: boolean;
}

const initialState: InterviewState = {
  categories: [],
  tracks: [],
  sessions: [],
  currentSession: null,
  candidateProfile: null,
  currentResume: null,
  voiceBinding: null,
  isVoiceActive: false,
  isListening: false,
  isSpeaking: false,
  interimTranscript: "",
  isLoading: false,
  isLoadingTracks: false,
  isSubmittingAnswer: false,
  isStartingSession: false,
  isUploadingResume: false,
  isRegeneratingReport: false,
  error: null,
  configModalOpen: false,
  resumeModalOpen: false,
};

// ── Async Thunks ─────────────────────────────────────────────────────────────

export const fetchTracks = createAsyncThunk(
  "interview/fetchTracks",
  async (category: string | undefined, { rejectWithValue }) => {
    try {
      return await interviewApi.fetchInterviewTracks(category);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to load interview tracks.");
    }
  },
);

export const fetchCategories = createAsyncThunk(
  "interview/fetchCategories",
  async (_, { rejectWithValue }) => {
    try {
      return await interviewApi.fetchInterviewCategories();
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to load interview categories.");
    }
  },
);

export const fetchSessions = createAsyncThunk(
  "interview/fetchSessions",
  async (_, { rejectWithValue }) => {
    try {
      return await interviewApi.fetchInterviewSessions();
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to load past interview sessions.");
    }
  },
);

export const fetchSessionDetail = createAsyncThunk(
  "interview/fetchSessionDetail",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      return await interviewApi.fetchInterviewSessionDetail(sessionId);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to load session details.");
    }
  },
);

export const createSession = createAsyncThunk(
  "interview/createSession",
  async (config: InterviewConfigCreate, { rejectWithValue }) => {
    try {
      return await interviewApi.createInterviewSession(config);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create interview session.");
    }
  },
);

export const startSession = createAsyncThunk(
  "interview/startSession",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      return await interviewApi.startInterviewSession(sessionId);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to start interview simulation.");
    }
  },
);

export const submitAnswer = createAsyncThunk(
  "interview/submitAnswer",
  async (
    { sessionId, payload }: { sessionId: string; payload: InterviewAnswerSubmit },
    { rejectWithValue },
  ) => {
    try {
      return await interviewApi.submitInterviewAnswer(sessionId, payload);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to evaluate answer turn.");
    }
  },
);

export const pauseSession = createAsyncThunk(
  "interview/pauseSession",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      return await interviewApi.pauseInterviewSession(sessionId);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to pause session.");
    }
  },
);

export const resumeSession = createAsyncThunk(
  "interview/resumeSession",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      return await interviewApi.resumeInterviewSession(sessionId);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to resume session.");
    }
  },
);

export const completeSession = createAsyncThunk(
  "interview/completeSession",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      return await interviewApi.completeInterviewSession(sessionId);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to complete interview dossier.");
    }
  },
);

export const deleteSession = createAsyncThunk(
  "interview/deleteSession",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      await interviewApi.deleteInterviewSession(sessionId);
      return sessionId;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to delete session.");
    }
  },
);

export const abandonSession = createAsyncThunk(
  "interview/abandonSession",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      return await interviewApi.abandonInterviewSession(sessionId);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to abandon session.");
    }
  },
);

export const regenerateReport = createAsyncThunk(
  "interview/regenerateReport",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      return await interviewApi.regenerateInterviewReport(sessionId);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to regenerate report.");
    }
  },
);

export const fetchCandidateProfile = createAsyncThunk(
  "interview/fetchCandidateProfile",
  async (_, { rejectWithValue }) => {
    try {
      return await interviewApi.fetchCandidateProfile();
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to load candidate profile.");
    }
  },
);

export const updateCandidateProfile = createAsyncThunk(
  "interview/updateCandidateProfile",
  async (payload: Partial<CandidateProfile>, { rejectWithValue }) => {
    try {
      return await interviewApi.updateCandidateProfile(payload);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update profile.");
    }
  },
);

export const uploadResume = createAsyncThunk(
  "interview/uploadResume",
  async (file: File, { rejectWithValue }) => {
    try {
      const uploadRes = await interviewApi.uploadResumeAsset(file);
      return await interviewApi.fetchResumeAsset(uploadRes.asset_id);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to upload resume asset.");
    }
  },
);

export const fetchResume = createAsyncThunk(
  "interview/fetchResume",
  async (assetId: string, { rejectWithValue }) => {
    try {
      return await interviewApi.fetchResumeAsset(assetId);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch resume.");
    }
  },
);

export const updateResumeFacts = createAsyncThunk(
  "interview/updateResumeFacts",
  async (
    { assetId, updates }: { assetId: string; updates: ResumeFactUpdateRequest[] },
    { rejectWithValue },
  ) => {
    try {
      const updatedFacts = await interviewApi.updateResumeFacts(assetId, updates);
      return { assetId, updatedFacts };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update resume facts.");
    }
  },
);

export const consentResume = createAsyncThunk(
  "interview/consentResume",
  async (
    { assetId, consent }: { assetId: string; consent: boolean },
    { rejectWithValue },
  ) => {
    try {
      await interviewApi.consentResumeAsset(assetId, consent);
      return { assetId, consent_status: consent ? "CONFIRMED" : "REVOKED" };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update consent.");
    }
  },
);

export const deleteResume = createAsyncThunk(
  "interview/deleteResume",
  async (assetId: string, { rejectWithValue }) => {
    try {
      await interviewApi.deleteResumeAsset(assetId);
      return assetId;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to delete resume.");
    }
  },
);

export const bindVoice = createAsyncThunk(
  "interview/bindVoice",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      return await interviewApi.bindVoiceSession(sessionId);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to bind voice session.");
    }
  },
);

export const interruptVoice = createAsyncThunk(
  "interview/interruptVoice",
  async (
    { sessionId, voiceId }: { sessionId: string; voiceId: string },
    { rejectWithValue },
  ) => {
    try {
      return await interviewApi.interruptVoiceSession(sessionId, voiceId);
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to interrupt voice.");
    }
  },
);

export const closeVoice = createAsyncThunk(
  "interview/closeVoice",
  async (
    { sessionId, voiceId }: { sessionId: string; voiceId: string },
    { rejectWithValue },
  ) => {
    try {
      await interviewApi.closeVoiceSession(sessionId, voiceId);
      return voiceId;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to close voice session.");
    }
  },
);

// ── Slice Definition ─────────────────────────────────────────────────────────

const interviewSlice = createSlice({
  name: "interview",
  initialState,
  reducers: {
    setConfigModalOpen(state, action: PayloadAction<boolean>) {
      state.configModalOpen = action.payload;
    },
    setResumeModalOpen(state, action: PayloadAction<boolean>) {
      state.resumeModalOpen = action.payload;
    },
    setInterimTranscript(state, action: PayloadAction<string>) {
      state.interimTranscript = action.payload;
    },
    setIsListening(state, action: PayloadAction<boolean>) {
      state.isListening = action.payload;
    },
    setIsSpeaking(state, action: PayloadAction<boolean>) {
      state.isSpeaking = action.payload;
    },
    clearVoiceState(state) {
      state.voiceBinding = null;
      state.isVoiceActive = false;
      state.isListening = false;
      state.isSpeaking = false;
      state.interimTranscript = "";
    },
    clearCurrentSession(state) {
      state.currentSession = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Tracks Catalog
    builder.addCase(fetchTracks.pending, (state) => {
      state.isLoadingTracks = true;
    });
    builder.addCase(fetchTracks.fulfilled, (state, action) => {
      state.isLoadingTracks = false;
      state.tracks = action.payload;
    });
    builder.addCase(fetchTracks.rejected, (state, action) => {
      state.isLoadingTracks = false;
      state.error = action.payload as string;
    });

    // Categories
    builder.addCase(fetchCategories.fulfilled, (state, action) => {
      state.categories = action.payload;
    });

    // Sessions List
    builder.addCase(fetchSessions.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchSessions.fulfilled, (state, action) => {
      state.isLoading = false;
      state.sessions = action.payload;
    });
    builder.addCase(fetchSessions.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });

    // Session Detail
    builder.addCase(fetchSessionDetail.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchSessionDetail.fulfilled, (state, action) => {
      state.isLoading = false;
      state.currentSession = action.payload;
    });
    builder.addCase(fetchSessionDetail.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });

    // Create Session
    builder.addCase(createSession.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(createSession.fulfilled, (state, action) => {
      state.isLoading = false;
      state.currentSession = action.payload;
      state.configModalOpen = false;
    });
    builder.addCase(createSession.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });

    // Start Session
    builder.addCase(startSession.pending, (state) => {
      state.isStartingSession = true;
      state.error = null;
    });
    builder.addCase(startSession.fulfilled, (state, action) => {
      state.isStartingSession = false;
      state.currentSession = action.payload;
    });
    builder.addCase(startSession.rejected, (state, action) => {
      state.isStartingSession = false;
      state.error = action.payload as string;
    });

    // Submit Answer
    builder.addCase(submitAnswer.pending, (state) => {
      state.isSubmittingAnswer = true;
      state.error = null;
    });
    builder.addCase(submitAnswer.fulfilled, (state, action) => {
      state.isSubmittingAnswer = false;
      state.currentSession = action.payload;
    });
    builder.addCase(submitAnswer.rejected, (state, action) => {
      state.isSubmittingAnswer = false;
      state.error = action.payload as string;
    });

    // Pause / Resume / Complete / Abandon
    builder.addCase(pauseSession.fulfilled, (state, action) => {
      state.currentSession = action.payload;
    });
    builder.addCase(resumeSession.fulfilled, (state, action) => {
      state.currentSession = action.payload;
    });
    builder.addCase(completeSession.fulfilled, (state, action) => {
      state.currentSession = action.payload;
    });
    builder.addCase(abandonSession.fulfilled, (state, action) => {
      state.currentSession = action.payload;
    });

    // Report Regeneration
    builder.addCase(regenerateReport.pending, (state) => {
      state.isRegeneratingReport = true;
    });
    builder.addCase(regenerateReport.fulfilled, (state, action) => {
      state.isRegeneratingReport = false;
      if (state.currentSession) {
        state.currentSession.report = action.payload;
      }
    });
    builder.addCase(regenerateReport.rejected, (state, action) => {
      state.isRegeneratingReport = false;
      state.error = action.payload as string;
    });

    // Candidate Profile
    builder.addCase(fetchCandidateProfile.fulfilled, (state, action) => {
      state.candidateProfile = action.payload;
    });
    builder.addCase(updateCandidateProfile.fulfilled, (state, action) => {
      state.candidateProfile = action.payload;
    });

    // Resume Assets
    builder.addCase(uploadResume.pending, (state) => {
      state.isUploadingResume = true;
      state.error = null;
    });
    builder.addCase(uploadResume.fulfilled, (state, action) => {
      state.isUploadingResume = false;
      state.currentResume = action.payload;
    });
    builder.addCase(uploadResume.rejected, (state, action) => {
      state.isUploadingResume = false;
      state.error = action.payload as string;
    });
    builder.addCase(fetchResume.fulfilled, (state, action) => {
      state.currentResume = action.payload;
    });
    builder.addCase(updateResumeFacts.fulfilled, (state, action) => {
      if (state.currentResume && state.currentResume.asset.asset_id === action.payload.assetId) {
        const updatedMap = new Map(action.payload.updatedFacts.map((f) => [f.id, f]));
        state.currentResume.facts = state.currentResume.facts.map((f) => updatedMap.get(f.id) || f);
      }
    });
    builder.addCase(consentResume.fulfilled, (state, action) => {
      if (state.currentResume && state.currentResume.asset.asset_id === action.payload.assetId) {
        state.currentResume.asset.consent_status = action.payload.consent_status;
      }
    });
    builder.addCase(deleteResume.fulfilled, (state, action) => {
      if (state.currentResume?.asset.asset_id === action.payload) {
        state.currentResume = null;
      }
    });

    // Voice Binding
    builder.addCase(bindVoice.fulfilled, (state, action) => {
      state.voiceBinding = action.payload;
      state.isVoiceActive = true;
    });
    builder.addCase(closeVoice.fulfilled, (state) => {
      state.voiceBinding = null;
      state.isVoiceActive = false;
      state.isListening = false;
      state.isSpeaking = false;
    });

    // Delete Session
    builder.addCase(deleteSession.fulfilled, (state, action) => {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload);
      if (state.currentSession?.id === action.payload) {
        state.currentSession = null;
      }
    });
  },
});

export const {
  setConfigModalOpen,
  setResumeModalOpen,
  setInterimTranscript,
  setIsListening,
  setIsSpeaking,
  clearVoiceState,
  clearCurrentSession,
  clearError,
} = interviewSlice.actions;
export default interviewSlice.reducer;
