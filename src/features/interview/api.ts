/**
 * Chaos Computer Club Medi-Caps — AI Interview API Client
 * Typed transport over FastAPI /api/interview endpoints.
 */

import { apiFetch } from "@/lib/auth";
import type {
  InterviewCategoryInfo,
  InterviewTrackSummary,
  InterviewTrackDetail,
  InterviewConfigCreate,
  InterviewAnswerSubmit,
  InterviewSessionDetail,
  InterviewSessionListItem,
  InterviewReportDetail,
  CandidateProfile,
  ResumeUploadResponse,
  ResumeDetailResponse,
  ResumeFactItem,
  ResumeFactUpdateRequest,
  VoiceBindingResponse,
} from "./types";

export async function fetchInterviewTracks(category?: string): Promise<InterviewTrackSummary[]> {
  const query = category && category !== "ALL" ? `?category=${encodeURIComponent(category)}` : "";
  return await apiFetch<InterviewTrackSummary[]>(`/interview/tracks${query}`);
}

export async function fetchInterviewTrackDetail(slug: string): Promise<InterviewTrackDetail> {
  return await apiFetch<InterviewTrackDetail>(`/interview/tracks/${slug}`);
}

export async function fetchInterviewCategories(): Promise<InterviewCategoryInfo[]> {
  return await apiFetch<InterviewCategoryInfo[]>("/interview/categories");
}

export async function fetchInterviewSessions(limit = 50, offset = 0): Promise<InterviewSessionListItem[]> {
  return await apiFetch<InterviewSessionListItem[]>(`/interview/sessions?limit=${limit}&offset=${offset}`);
}

export async function fetchInterviewSessionDetail(sessionId: string): Promise<InterviewSessionDetail> {
  return await apiFetch<InterviewSessionDetail>(`/interview/sessions/${sessionId}`);
}

export async function createInterviewSession(config: InterviewConfigCreate): Promise<InterviewSessionDetail> {
  return await apiFetch<InterviewSessionDetail>("/interview/sessions", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function startInterviewSession(sessionId: string): Promise<InterviewSessionDetail> {
  return await apiFetch<InterviewSessionDetail>(`/interview/sessions/${sessionId}/start`, {
    method: "POST",
  });
}

export async function submitInterviewAnswer(
  sessionId: string,
  payload: InterviewAnswerSubmit,
): Promise<InterviewSessionDetail> {
  return await apiFetch<InterviewSessionDetail>(`/interview/sessions/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function pauseInterviewSession(sessionId: string): Promise<InterviewSessionDetail> {
  return await apiFetch<InterviewSessionDetail>(`/interview/sessions/${sessionId}/pause`, {
    method: "POST",
  });
}

export async function resumeInterviewSession(sessionId: string): Promise<InterviewSessionDetail> {
  return await apiFetch<InterviewSessionDetail>(`/interview/sessions/${sessionId}/resume`, {
    method: "POST",
  });
}

export async function completeInterviewSession(sessionId: string): Promise<InterviewSessionDetail> {
  return await apiFetch<InterviewSessionDetail>(`/interview/sessions/${sessionId}/complete`, {
    method: "POST",
  });
}

export async function abandonInterviewSession(sessionId: string): Promise<InterviewSessionDetail> {
  return await apiFetch<InterviewSessionDetail>(`/interview/sessions/${sessionId}/abandon`, {
    method: "POST",
  });
}

export async function fetchInterviewReport(sessionId: string): Promise<InterviewReportDetail> {
  return await apiFetch<InterviewReportDetail>(`/interview/sessions/${sessionId}/report`);
}

export async function regenerateInterviewReport(sessionId: string): Promise<InterviewReportDetail> {
  return await apiFetch<InterviewReportDetail>(`/interview/sessions/${sessionId}/report/regenerate`, {
    method: "POST",
  });
}

export async function deleteInterviewSession(sessionId: string): Promise<{ success: boolean; message: string }> {
  return await apiFetch<{ success: boolean; message: string }>(`/interview/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

// ─── CANDIDATE PROFILE API ───────────────────────────────────────────────────

export async function fetchCandidateProfile(): Promise<CandidateProfile> {
  return await apiFetch<CandidateProfile>("/interview/profile");
}

export async function updateCandidateProfile(payload: Partial<CandidateProfile>): Promise<CandidateProfile> {
  return await apiFetch<CandidateProfile>("/interview/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCandidateProfile(): Promise<{ success: boolean; message: string }> {
  return await apiFetch<{ success: boolean; message: string }>("/interview/profile", {
    method: "DELETE",
  });
}

// ─── RESUME ASSET & FACTS API ────────────────────────────────────────────────

export async function uploadResumeAsset(file: File): Promise<ResumeUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return await apiFetch<ResumeUploadResponse>("/interview/resumes", {
    method: "POST",
    body: formData,
  });
}

export async function fetchResumeAsset(assetId: string): Promise<ResumeDetailResponse> {
  return await apiFetch<ResumeDetailResponse>(`/interview/resumes/${assetId}`);
}

export async function updateResumeFacts(
  assetId: string,
  updates: ResumeFactUpdateRequest[],
): Promise<ResumeFactItem[]> {
  return await apiFetch<ResumeFactItem[]>(`/interview/resumes/${assetId}/facts`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function consentResumeAsset(
  assetId: string,
  consent = true,
  purpose = "USE_RESUME_IN_INTERVIEW",
): Promise<{ asset_id: string; consent_status: string; purpose: string }> {
  return await apiFetch(`/interview/resumes/${assetId}/consent`, {
    method: "POST",
    body: JSON.stringify({ consent, purpose }),
  });
}

export async function deleteResumeAsset(assetId: string): Promise<{ success: boolean; message: string }> {
  return await apiFetch<{ success: boolean; message: string }>(`/interview/resumes/${assetId}`, {
    method: "DELETE",
  });
}

// ─── VOICE SESSION BINDING API ───────────────────────────────────────────────

export async function bindVoiceSession(sessionId: string): Promise<VoiceBindingResponse> {
  return await apiFetch<VoiceBindingResponse>(`/interview/sessions/${sessionId}/voice-session`, {
    method: "POST",
  });
}

export async function interruptVoiceSession(
  sessionId: string,
  voiceId: string,
): Promise<{ session_id: string; voice_id: string; interrupted: boolean }> {
  return await apiFetch(`/interview/sessions/${sessionId}/voice-session/${voiceId}/interrupt`, {
    method: "POST",
  });
}

export async function closeVoiceSession(
  sessionId: string,
  voiceId: string,
): Promise<{ success: boolean; message: string }> {
  return await apiFetch<{ success: boolean; message: string }>(
    `/interview/sessions/${sessionId}/voice-session/${voiceId}`,
    {
      method: "DELETE",
    },
  );
}
