/**
 * Chaos Computer Club Medi-Caps — Interview Configuration Modal
 * Candidate interview setup aligned with the CCC Medi-Caps dark tactical theme.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { createSession, setConfigModalOpen } from "@/store/slices/interviewSlice";
import type {
  InterviewCategory,
  ExperienceLevel,
  InterviewDifficulty,
  SupportedLanguage,
  InterviewConfigCreate,
} from "../types";
import {
  X,
  Sparkles,
  Terminal,
  Code,
  BrainCircuit,
  Layers,
  Server,
  Layout,
  Cpu,
  Database,
  Users,
  Briefcase,
  ChevronRight,
  Plus,
  Mic,
  Keyboard,
  FileCheck,
} from "lucide-react";

const CATEGORY_ICONS: Record<InterviewCategory, React.ComponentType<{ className?: string }>> = {
  TECHNICAL: Terminal,
  CODING: Code,
  DSA: BrainCircuit,
  SYSTEM_DESIGN: Layers,
  BACKEND: Server,
  FRONTEND: Layout,
  DEVOPS: Cpu,
  DATABASE_SQL: Database,
  BEHAVIORAL: Users,
  MIXED: Briefcase,
};

const ROLE_PRESETS = [
  "Backend Systems Engineer",
  "Distributed Systems Engineer",
  "Full-Stack Software Engineer",
  "Frontend Architecture Engineer",
  "Site Reliability / DevOps Engineer",
  "Security & Vulnerability Researcher",
];

export function InterviewConfigModal() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { categories, isLoading, currentResume } = useAppSelector((state) => state.interview);

  const [targetRole, setTargetRole] = useState("Backend Systems Engineer");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("ENTRY_LEVEL");
  const [category, setCategory] = useState<InterviewCategory>("TECHNICAL");
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("MEDIUM");
  const [durationMinutes, setDurationMinutes] = useState<15 | 30 | 45 | 60>(30);
  const [preferredLanguage, setPreferredLanguage] = useState<SupportedLanguage>("python");
  const [mode, setMode] = useState<"TEXT" | "VOICE">("TEXT");
  const [useUploadedResume, setUseUploadedResume] = useState(
    currentResume?.asset?.consent_status === "CONFIRMED",
  );
  const [focusTopics, setFocusTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [resumeNotes, setResumeNotes] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedCategoryConfig = categories.find((c) => c.id === category);

  const handleAddTopic = () => {
    const trimmed = topicInput.trim();
    if (trimmed && !focusTopics.includes(trimmed)) {
      setFocusTopics([...focusTopics, trimmed]);
      setTopicInput("");
    }
  };

  const handleRemoveTopic = (topic: string) => {
    setFocusTopics(focusTopics.filter((t) => t !== topic));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRole.trim()) return;

    const resumeAssetIds: string[] =
      useUploadedResume && currentResume?.asset?.asset_id
        ? [currentResume.asset.asset_id]
        : [];

    const payload: InterviewConfigCreate = {
      target_role: targetRole.trim(),
      experience_level: experienceLevel,
      category,
      difficulty,
      duration_minutes: durationMinutes,
      preferred_language: preferredLanguage,
      focus_topics: focusTopics.length > 0 ? focusTopics : (selectedCategoryConfig?.default_topics ?? []),
      resume_notes: resumeNotes.trim() || undefined,
      job_description: jobDescription.trim() || undefined,
      resume_asset_ids: resumeAssetIds,
      mode,
    };

    const action = await dispatch(createSession(payload));
    if (createSession.fulfilled.match(action)) {
      navigate(`/interview/${action.payload.id}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#1F1F1F] border border-white/[0.08] rounded-[24px] shadow-2xl p-6 sm:p-8 text-white"
        style={{ overscrollBehavior: "contain" }}
      >
        {/* Close Button */}
        <button
          onClick={() => dispatch(setConfigModalOpen(false))}
          className="absolute top-5 right-5 p-2 rounded-[8px] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          aria-label="Close configuration modal"
        >
          <X className="size-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="flex items-center justify-center size-10 rounded-[12px] bg-[#B1FA63]/15 border border-[#B1FA63]/30 text-[#B1FA63]">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-display uppercase tracking-wide text-white">Configure AI Interview</h2>
            <p className="text-xs font-sans text-zinc-400">Calibrated against Medi-Caps and high-scale engineering bars</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Target Role & Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
              Target Role
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Distributed Systems Engineer"
              required
              className="w-full px-4 py-2.5 rounded-[12px] bg-[#171717] border border-white/[0.08] text-white placeholder-zinc-500 focus:outline-none focus:border-[#B1FA63] text-sm font-sans transition-all"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ROLE_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setTargetRole(preset)}
                  className={`text-[11px] font-heading font-bold uppercase tracking-wider px-2.5 py-1 rounded-[6px] transition-colors cursor-pointer ${
                    targetRole === preset
                      ? "bg-[#B1FA63]/15 text-[#B1FA63] border border-[#B1FA63]/30"
                      : "bg-[#171717] text-zinc-400 hover:text-zinc-200 border border-white/[0.04]"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Track Category Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
              Track Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {categories.map((cat) => {
                const IconComponent = CATEGORY_ICONS[cat.id] || Terminal;
                const isSelected = category === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-start p-3.5 rounded-[16px] border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#171717] border-[#B1FA63] text-white shadow-sm shadow-[#B1FA63]/10"
                        : "bg-[#171717] border-white/[0.06] text-zinc-300 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <IconComponent className={`size-4 ${isSelected ? "text-[#B1FA63]" : "text-zinc-400"}`} />
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-[4px] bg-[#1F1F1F] text-zinc-300 border border-white/[0.06]">
                        {cat.badge}
                      </span>
                    </div>
                    <span className="text-sm font-display uppercase tracking-wide leading-tight mb-1">{cat.name}</span>
                    <span className="text-[11px] font-sans text-zinc-400 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interaction Mode Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
                Interaction Modality
              </label>
              <span className="text-[11px] font-sans text-zinc-500">Choose preferred response medium</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("TEXT")}
                className={`p-3.5 rounded-[16px] border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  mode === "TEXT"
                    ? "bg-[#171717] border-[#B1FA63] text-white shadow-sm shadow-[#B1FA63]/10"
                    : "bg-[#171717] border-white/[0.06] text-zinc-400 hover:border-white/20"
                }`}
              >
                <div
                  className={`p-2 rounded-[10px] ${
                    mode === "TEXT" ? "bg-[#B1FA63]/20 text-[#B1FA63]" : "bg-[#1F1F1F] text-zinc-400"
                  }`}
                >
                  <Keyboard className="size-4" />
                </div>
                <div>
                  <div className="font-heading font-bold uppercase tracking-wider text-xs text-white">
                    Text & Terminal Mode
                  </div>
                  <div className="text-[11px] font-sans text-zinc-400">
                    Structured markdown answers & live Monaco code editor
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("VOICE")}
                className={`p-3.5 rounded-[16px] border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  mode === "VOICE"
                    ? "bg-[#171717] border-[#B1FA63] text-white shadow-sm shadow-[#B1FA63]/10"
                    : "bg-[#171717] border-white/[0.06] text-zinc-400 hover:border-white/20"
                }`}
              >
                <div
                  className={`p-2 rounded-[10px] ${
                    mode === "VOICE" ? "bg-[#B1FA63]/20 text-[#B1FA63]" : "bg-[#1F1F1F] text-zinc-400"
                  }`}
                >
                  <Mic className="size-4" />
                </div>
                <div>
                  <div className="font-heading font-bold uppercase tracking-wider text-xs text-white">
                    Interactive Voice Mode
                  </div>
                  <div className="text-[11px] font-sans text-zinc-400">
                    Spoken conversational interview via Sarvam speech engine
                  </div>
                </div>
              </button>
            </div>
            {mode === "VOICE" && (
              <p className="text-[11px] font-sans text-[#B1FA63]/80 italic pl-1">
                Voice simulation captures mic input and streams neural speech. Text fallback is always available.
              </p>
            )}
          </div>

          {/* Linked Resume Asset Context */}
          {currentResume?.asset && currentResume.asset.consent_status === "CONFIRMED" && (
            <div className="p-3.5 rounded-[16px] bg-[#171717] border border-[#B1FA63]/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FileCheck className="size-4 text-[#B1FA63]" />
                <div>
                  <div className="text-xs font-heading font-bold uppercase tracking-wider text-white">
                    Link Verified Resume ({currentResume.facts.length} facts)
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    {currentResume.asset.original_filename}
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-sans text-zinc-300">
                <input
                  type="checkbox"
                  checked={useUploadedResume}
                  onChange={(e) => setUseUploadedResume(e.target.checked)}
                  className="rounded border-zinc-700 text-[#B1FA63] focus:ring-[#B1FA63]"
                />
                <span>Include in calibration</span>
              </label>
            </div>
          )}

          {/* Seniority, Difficulty & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Seniority */}
            <div className="space-y-2">
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
                Seniority Level
              </label>
              <div className="grid grid-cols-3 gap-1 bg-[#171717] p-1 rounded-[12px] border border-white/[0.08]">
                {(["ENTRY_LEVEL", "MID_LEVEL", "SENIOR"] as ExperienceLevel[]).map((lvl) => (
                  <button
                    type="button"
                    key={lvl}
                    onClick={() => setExperienceLevel(lvl)}
                    className={`py-1.5 text-[11px] font-heading font-bold uppercase tracking-wider rounded-[8px] transition-colors cursor-pointer ${
                      experienceLevel === lvl
                        ? "bg-[#B1FA63] text-black shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {lvl.replace("_LEVEL", "").toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
                Difficulty
              </label>
              <div className="grid grid-cols-3 gap-1 bg-[#171717] p-1 rounded-[12px] border border-white/[0.08]">
                {(["EASY", "MEDIUM", "HARD"] as InterviewDifficulty[]).map((diff) => (
                  <button
                    type="button"
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={`py-1.5 text-[11px] font-heading font-bold uppercase tracking-wider rounded-[8px] transition-colors cursor-pointer ${
                      difficulty === diff
                        ? "bg-[#B1FA63]/15 text-[#B1FA63] border border-[#B1FA63]/30"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {diff.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
                Duration
              </label>
              <div className="grid grid-cols-4 gap-1 bg-[#171717] p-1 rounded-[12px] border border-white/[0.08]">
                {([15, 30, 45, 60] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setDurationMinutes(m)}
                    className={`py-1.5 text-[11px] font-mono font-bold rounded-[8px] transition-colors cursor-pointer ${
                      durationMinutes === m
                        ? "bg-white/[0.1] text-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Programming Language (if coding/dsa) */}
          {(selectedCategoryConfig?.supports_code || category === "MIXED") && (
            <div className="space-y-2">
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
                Code Language
              </label>
              <div className="flex flex-wrap gap-2">
                {(["python", "cpp", "java", "typescript", "javascript"] as SupportedLanguage[]).map((lang) => (
                  <button
                    type="button"
                    key={lang}
                    onClick={() => setPreferredLanguage(lang)}
                    className={`px-3 py-1.5 text-xs font-mono rounded-[8px] border transition-all cursor-pointer ${
                      preferredLanguage === lang
                        ? "bg-[#B1FA63]/15 text-[#B1FA63] border-[#B1FA63]/40"
                        : "bg-[#171717] text-zinc-400 border-white/[0.08] hover:border-white/20"
                    }`}
                  >
                    {lang === "cpp" ? "C++ 20" : lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Focus Topics Customizer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
                Custom Focus Directives
              </label>
              <span className="text-[11px] font-sans text-zinc-500">Optional topics to probe</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTopic();
                  }
                }}
                placeholder="e.g. Concurrency, Distributed Caching"
                className="flex-1 px-3.5 py-2 rounded-[10px] bg-[#171717] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#B1FA63]"
              />
              <button
                type="button"
                onClick={handleAddTopic}
                className="px-4 py-2 rounded-[10px] bg-[#171717] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-200 text-xs font-heading font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="size-3.5" /> Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {focusTopics.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-mono bg-[#171717] text-[#B1FA63] border border-[#B1FA63]/25"
                >
                  {topic}
                  <button
                    type="button"
                    onClick={() => handleRemoveTopic(topic)}
                    className="text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {focusTopics.length === 0 && selectedCategoryConfig?.default_topics && (
                <span className="text-xs font-sans text-zinc-500 italic">
                  Using default topics: {selectedCategoryConfig.default_topics.slice(0, 3).join(", ")}…
                </span>
              )}
            </div>
          </div>

          {/* Advanced Accordion: Resume & Job Description */}
          <div className="pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-heading font-bold uppercase tracking-wider text-[#B1FA63] hover:text-[#9de34f] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ChevronRight className={`size-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
              {showAdvanced ? "Hide Advanced Calibration" : "Add Resume Context & Job Description (Optional)"}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 pt-3 border-t border-white/[0.06]">
                <div className="space-y-1">
                  <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
                    Candidate Resume Notes / Project Details
                  </label>
                  <textarea
                    rows={2}
                    value={resumeNotes}
                    onChange={(e) => setResumeNotes(e.target.value)}
                    placeholder="e.g. Built high-throughput Redis queues, optimized Postgres indexes..."
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#171717] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#B1FA63] font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
                    Target Job Description Snippet
                  </label>
                  <textarea
                    rows={2}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste job qualifications or team expectations to bias question formulation..."
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#171717] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#B1FA63] font-sans"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={() => dispatch(setConfigModalOpen(false))}
              className="h-10 px-4 rounded-[12px] text-xs font-heading font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !targetRole.trim()}
              className="h-10 px-6 rounded-[12px] text-xs font-heading font-bold uppercase tracking-wider text-black bg-[#B1FA63] hover:bg-[#9de34f] shadow-md shadow-[#B1FA63]/20 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <span>Calibrating…</span>
              ) : (
                <>
                  <span>Launch Interview</span>
                  <ChevronRight className="size-4 stroke-[3]" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
