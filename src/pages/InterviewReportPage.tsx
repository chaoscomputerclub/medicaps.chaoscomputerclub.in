/**
 * Chaos Computer Club Medi-Caps — AI Interview Coaching Dossier / Report Page
 * Comprehensive evidence-backed candidate report with dimension breakdowns,
 * per-question evidence anchors, verbatim candidate answer quotes,
 * non-binary practice readiness milestones, and dossier regeneration.
 * Styled in 100% fidelity to the CCC Medi-Caps tactical dark theme (#B1FA63 accent).
 */

import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchSessionDetail, regenerateReport } from "@/store/slices/interviewSlice";
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FileText,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MessageSquare,
  Code as CodeIcon,
  ShieldCheck,
  Quote,
  Target,
  Layers,
} from "lucide-react";

const RUBRIC_DIMENSION_EXPLANATIONS: Record<string, string> = {
  "Problem Solving": "Algorithmic thinking, breakdown of complex constraints, and handling of tricky edge cases.",
  "System Architecture": "Scalability, modular component decomposition, data persistence, and trade-off analysis.",
  "Code Quality": "Clean implementation, idiomatic syntax, modularity, readability, and time/space complexity.",
  "Communication": "Structured reasoning, technical articulation, active clarification of constraints, and clarity.",
  "Engineering Rigor": "Anticipation of failure modes, boundary validation, and defensive programming standards.",
};

function getReadinessMilestone(verdict: string, score: number): { label: string; isStrong: boolean } {
  if (verdict === "STRONG_HIRE" || score >= 85) {
    return { label: "EXCEEDS PRACTICE STANDARD", isStrong: true };
  }
  if (verdict === "HIRE" || verdict === "LEANING_HIRE" || score >= 70) {
    return { label: "PRACTICE READY", isStrong: true };
  }
  if (verdict === "NEUTRAL" || score >= 55) {
    return { label: "FOUNDATION DEMONSTRATED", isStrong: false };
  }
  if (verdict === "LEANING_NO_HIRE" || score >= 45) {
    return { label: "TARGETED REFINEMENT NEEDED", isStrong: false };
  }
  return { label: "DEVELOPING FOUNDATION", isStrong: false };
}

export function InterviewReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentSession, isLoading, isRegeneratingReport } = useAppSelector((state) => state.interview);

  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (sessionId) {
      dispatch(fetchSessionDetail(sessionId));
    }
  }, [sessionId, dispatch]);

  const toggleTurn = (qId: string) => {
    setExpandedTurns((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const handleRegenerate = async () => {
    if (!sessionId || isRegeneratingReport) return;
    await dispatch(regenerateReport(sessionId));
  };

  if (isLoading && !currentSession) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#B1FA63] border-t-transparent rounded-full animate-spin" />
          <span className="font-heading font-bold uppercase tracking-wider text-xs text-zinc-400">
            Synthesizing coaching dossier…
          </span>
        </div>
      </div>
    );
  }

  const report = currentSession?.report;

  if (!currentSession || !report) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white p-4">
        <div className="max-w-md text-center p-8 rounded-[24px] bg-[#1F1F1F] border border-white/[0.08] space-y-4 shadow-xl">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="font-display uppercase tracking-wide text-lg text-white">
            Coaching Dossier Incomplete
          </h2>
          <p className="font-sans text-xs sm:text-sm text-zinc-400">
            This interview session is still underway or awaiting conclusion synthesis.
          </p>
          <button
            onClick={() => navigate(`/interview/${sessionId}`)}
            className="px-5 py-2.5 bg-[#B1FA63] hover:bg-[#9de34f] text-black font-heading font-bold uppercase tracking-wider text-xs rounded-[12px] transition-all"
          >
            Go to Simulation Console
          </button>
        </div>
      </div>
    );
  }

  const milestone = getReadinessMilestone(report.verdict, report.overall_score);

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto font-sans">
      {/* Header & Verdict Banner */}
      <div className="rounded-[24px] bg-[#1F1F1F] border border-white/[0.08] p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading font-bold uppercase tracking-wider text-[11px] px-3 py-0.5 rounded-full bg-[#B1FA63]/15 text-[#B1FA63] border border-[#B1FA63]/30">
                Coaching Dossier
              </span>
              {currentSession.plan_version && (
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#171717] border border-white/[0.08] text-zinc-400">
                  Plan {currentSession.plan_version}
                </span>
              )}
              {currentSession.rubric_version && (
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#171717] border border-white/[0.08] text-zinc-400">
                  Rubric {currentSession.rubric_version}
                </span>
              )}
              <span className="font-mono text-xs text-zinc-500">
                {new Date(report.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <h1 className="font-display uppercase tracking-wide text-2xl sm:text-3xl text-white">
              {currentSession.target_role}
            </h1>
            <div className="flex flex-wrap items-center gap-2 font-heading font-bold uppercase tracking-wider text-[11px] text-zinc-400">
              <span className="px-2 py-0.5 rounded-full bg-[#171717] border border-white/[0.04]">
                {currentSession.category}
              </span>
              <span>•</span>
              <span className="capitalize">{currentSession.experience_level.toLowerCase()}</span>
              <span>•</span>
              <span className="font-mono">{currentSession.difficulty}</span>
              <span>•</span>
              <span className="font-mono text-[#B1FA63]">{currentSession.mode || "TEXT"}</span>
            </div>
          </div>

          {/* Constructive Readiness Milestone Pill (CCC-AI-0705) */}
          <div className="flex flex-col items-end">
            <div
              className={`flex items-center gap-3.5 px-6 py-3.5 rounded-[20px] border ${
                milestone.isStrong
                  ? "bg-[#B1FA63]/15 border-[#B1FA63]/30 text-[#B1FA63]"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-400"
              }`}
            >
              <Award className="w-8 h-8 shrink-0" />
              <div>
                <div className="text-3xl font-black font-mono tracking-tight leading-none tabular-nums">
                  {report.overall_score}
                  <span className="text-xs text-zinc-400 font-normal"> / 100</span>
                </div>
                <div className="font-heading font-bold uppercase tracking-wider text-xs mt-1">
                  {milestone.label}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="pt-6 border-t border-white/[0.08] space-y-2">
          <h2 className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63] flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            <span>Executive Evaluation Summary</span>
          </h2>
          <p className="font-sans text-xs sm:text-sm text-zinc-200 leading-relaxed bg-[#171717] p-5 rounded-[16px] border border-white/[0.08]">
            {report.executive_summary}
          </p>
        </div>
      </div>

      {/* Dimensional Breakdown with Rubric Explanations (CCC-AI-0705) */}
      {Object.keys(report.dimension_breakdown).length > 0 && (
        <div className="p-6 sm:p-8 rounded-[24px] bg-[#1F1F1F] border border-white/[0.08] space-y-5">
          <h2 className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#B1FA63]" />
            <span>Dimensional Evaluation Competencies</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(report.dimension_breakdown).map(([dim, score]) => (
              <div key={dim} className="space-y-2.5 p-4 rounded-[16px] bg-[#171717] border border-white/[0.08]">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-sans font-semibold text-zinc-100">{dim}</span>
                  <span className="font-mono font-bold text-[#B1FA63] tabular-nums">{score}%</span>
                </div>
                <div className="w-full h-2 bg-[#121212] rounded-full overflow-hidden border border-white/[0.04]">
                  <div
                    className="h-full bg-gradient-to-r from-[#B1FA63] to-[#8fdc3e] rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                  />
                </div>
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  {RUBRIC_DIMENSION_EXPLANATIONS[dim] || "Evaluation of role-specific competencies and implementation precision."}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Blindspots Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Strengths */}
        <div className="p-6 sm:p-7 rounded-[24px] bg-[#1F1F1F] border border-[#B1FA63]/30 space-y-4 shadow-lg shadow-black/20">
          <div className="flex items-center gap-2 text-[#B1FA63] font-heading font-bold uppercase tracking-wider text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Observed Strengths</span>
          </div>
          <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-300 font-sans">
            {report.top_strengths.map((str, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B1FA63] shrink-0 mt-2" />
                <span className="leading-relaxed">{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Priority Areas to Improve */}
        <div className="p-6 sm:p-7 rounded-[24px] bg-[#1F1F1F] border border-amber-500/30 space-y-4 shadow-lg shadow-black/20">
          <div className="flex items-center gap-2 text-amber-400 font-heading font-bold uppercase tracking-wider text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Priority Areas to Improve</span>
          </div>
          <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-300 font-sans">
            {report.areas_to_improve.map((gap, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-2" />
                <span className="leading-relaxed">{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Evidence-Linked Turn Dossier (CCC-AI-0705) */}
      <div className="p-6 sm:p-8 rounded-[24px] bg-[#1F1F1F] border border-white/[0.08] space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#B1FA63]" />
              <span>Evidence-Linked Turn Audit</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Per-question review mapping your verbatim answers directly to rubric scoring and exemplar solutions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const allOpen = currentSession.questions.every((q) => expandedTurns[q.id]);
              const newState: Record<string, boolean> = {};
              currentSession.questions.forEach((q) => {
                newState[q.id] = !allOpen;
              });
              setExpandedTurns(newState);
            }}
            className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
          >
            Toggle All
          </button>
        </div>

        <div className="space-y-4">
          {currentSession.questions.map((q, idx) => {
            const matchingAns = currentSession.answers.find((a) => a.question_id === q.id);
            const matchingEval = currentSession.evaluations.find((e) => e.question_id === q.id);
            const isExpanded = !!expandedTurns[q.id];

            return (
              <div
                key={q.id}
                className="rounded-[20px] bg-[#171717] border border-white/[0.08] p-5 space-y-4 transition-all"
              >
                {/* Turn Header */}
                <div
                  onClick={() => toggleTurn(q.id)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63]">
                      Turn {idx + 1}
                    </span>
                    <span className="font-bold text-sm text-white font-sans">{q.title}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#1F1F1F] text-zinc-400 border border-white/[0.04]">
                      {q.topic}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {matchingEval && (
                      <span className="font-mono text-xs font-bold text-[#B1FA63] px-2.5 py-0.5 rounded-full bg-[#B1FA63]/10 border border-[#B1FA63]/25 tabular-nums">
                        {matchingEval.score} / 100
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                </div>

                {/* Collapsible Content Body */}
                {isExpanded && (
                  <div className="pt-4 border-t border-white/[0.06] space-y-5 text-xs animate-in fade-in">
                    {/* Prompt */}
                    <div className="space-y-1.5">
                      <div className="font-heading font-bold uppercase tracking-wider text-[10px] text-zinc-500">
                        Question Prompt:
                      </div>
                      <p className="font-sans text-zinc-300 leading-relaxed bg-[#121212] p-4 rounded-[14px] border border-white/[0.04]">
                        {q.prompt}
                      </p>
                    </div>

                    {/* Verbatim Candidate Answer */}
                    {matchingAns && (
                      <div className="space-y-1.5">
                        <div className="font-heading font-bold uppercase tracking-wider text-[10px] text-[#B1FA63] flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" /> Verbatim Candidate Answer:
                        </div>
                        <div className="font-sans text-zinc-200 leading-relaxed bg-[#121212] p-4 rounded-[14px] border border-white/[0.04] whitespace-pre-wrap">
                          {matchingAns.answer_text}
                        </div>
                        {matchingAns.submitted_code && (
                          <div className="mt-2 space-y-1">
                            <div className="font-heading font-bold uppercase tracking-wider text-[10px] text-zinc-500">
                              Submitted Code:
                            </div>
                            <pre className="p-4 bg-black rounded-[14px] border border-white/[0.06] font-mono text-xs text-[#B1FA63] overflow-x-auto leading-relaxed">
                              {matchingAns.submitted_code}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Evidence Quotes Anchor (CCC-AI-0705) */}
                    {matchingEval?.evidence_quotes && matchingEval.evidence_quotes.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-heading font-bold uppercase tracking-wider text-[10px] text-cyan-400 flex items-center gap-1">
                          <Quote className="w-3 h-3" /> Extracted Evidence Quotes:
                        </div>
                        <div className="space-y-1.5">
                          {matchingEval.evidence_quotes.map((quote, qIdx) => (
                            <blockquote
                              key={qIdx}
                              className="italic border-l-2 border-cyan-400 pl-3 py-1 font-sans text-zinc-300 bg-[#121212] rounded-r-[10px]"
                            >
                              “{quote}”
                            </blockquote>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Turn Strengths & Gaps */}
                    {matchingEval && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <div className="font-heading font-bold uppercase tracking-wider text-[10px] text-[#B1FA63]">
                            Turn Strengths:
                          </div>
                          <ul className="list-disc list-inside space-y-1 text-zinc-300 font-sans">
                            {matchingEval.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-1.5">
                          <div className="font-heading font-bold uppercase tracking-wider text-[10px] text-amber-400">
                            Gaps & Blindspots:
                          </div>
                          <ul className="list-disc list-inside space-y-1 text-zinc-300 font-sans">
                            {matchingEval.gaps.map((g, i) => (
                              <li key={i}>{g}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Model Exemplar Answer */}
                    {matchingEval?.model_answer && (
                      <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                        <div className="font-heading font-bold uppercase tracking-wider text-[10px] text-zinc-400">
                          Exemplar Benchmark Solution:
                        </div>
                        <p className="font-sans text-zinc-300 leading-relaxed bg-[#121212] p-4 rounded-[14px] border border-white/[0.04]">
                          {matchingEval.model_answer}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommended Practice Roadmap */}
      {report.recommended_practice.length > 0 && (
        <div className="p-6 sm:p-8 rounded-[24px] bg-[#1F1F1F] border border-white/[0.08] space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B1FA63]" />
              <span>Recommended Practice Actions</span>
            </h2>
            <Link
              to="/practice"
              className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63] hover:text-[#9de34f] flex items-center gap-1 transition-colors"
            >
              Open Practice Arena <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {report.recommended_practice.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-[18px] bg-[#171717] border border-white/[0.08] space-y-2.5 hover:border-[#B1FA63]/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs sm:text-sm font-sans">{item.topic}</span>
                  <span className="font-heading font-bold uppercase tracking-wider text-[10px] px-2.5 py-0.5 rounded-full bg-[#1F1F1F] border border-white/[0.08] text-[#B1FA63]">
                    {item.action_type.replace("_", " ")}
                  </span>
                </div>
                <p className="font-sans text-xs text-zinc-400 leading-relaxed">{item.description}</p>
                <Link
                  to={`/practice?q=${encodeURIComponent(item.topic)}`}
                  className="inline-flex items-center gap-1 font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63] hover:text-[#9de34f] pt-1"
                >
                  Solve Related Problems →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/[0.08]">
        <button
          onClick={() => navigate("/interview")}
          className="w-full sm:w-auto px-5 py-2.5 rounded-[12px] font-heading font-bold uppercase tracking-wider text-xs text-zinc-300 bg-[#1F1F1F] hover:bg-[#252525] border border-white/[0.08] transition-colors"
        >
          ← Return to Interview Hub
        </button>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Regenerate Report Button (CCC-AI-0705) */}
          <button
            onClick={handleRegenerate}
            disabled={isRegeneratingReport}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-[12px] font-heading font-bold uppercase tracking-wider text-xs text-zinc-300 bg-[#1F1F1F] hover:bg-[#252525] border border-white/[0.08] transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingReport ? "animate-spin text-[#B1FA63]" : ""}`} />
            <span>{isRegeneratingReport ? "Regenerating Dossier…" : "Regenerate Dossier"}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-[12px] font-heading font-bold uppercase tracking-wider text-xs text-zinc-300 bg-[#1F1F1F] hover:bg-[#252525] border border-white/[0.08] transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Print Dossier</span>
          </button>

          <button
            onClick={() => navigate("/interview")}
            className="flex-1 sm:flex-initial px-6 py-2.5 rounded-[12px] font-heading font-bold uppercase tracking-wider text-xs text-black bg-[#B1FA63] hover:bg-[#9de34f] shadow-md shadow-[#B1FA63]/20 transition-all inline-flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Practice Another Role</span>
          </button>
        </div>
      </div>
    </div>
  );
}
