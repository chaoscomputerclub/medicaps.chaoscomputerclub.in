/**
 * Chaos Computer Club Medi-Caps — AI Interview Workspace Page
 * Real-time interview simulation console with turn-by-turn question stream,
 * idempotent answer submission, live voice/STT workspace with barge-in interruption,
 * code/text dual modal editor, and full server lifecycle rehydration.
 * Styled in 100% fidelity to the CCC Medi-Caps tactical dark theme (#B1FA63 accent).
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchSessionDetail,
  startSession,
  submitAnswer,
  pauseSession,
  resumeSession,
  completeSession,
  abandonSession,
  bindVoice,
  interruptVoice,
  setInterimTranscript,
  setIsListening,
  setIsSpeaking,
  clearVoiceState,
} from "@/store/slices/interviewSlice";
import type { SupportedLanguage } from "@/features/interview/types";
import {
  Sparkles,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Send,
  Code as CodeIcon,
  MessageSquare,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Brain,
  Award,
  Terminal,
  ArrowRight,
  ShieldCheck,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  Radio,
  RotateCcw,
  X,
  RefreshCw,
} from "lucide-react";

export function InterviewWorkspacePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const {
    currentSession,
    isLoading,
    isSubmittingAnswer,
    isStartingSession,
    voiceBinding,
    isListening,
    isSpeaking,
    interimTranscript,
  } = useAppSelector((state) => state.interview);

  // Answer & Code state
  const [answerText, setAnswerText] = useState("");
  const [submittedCode, setSubmittedCode] = useState("");
  const [codeModeActive, setCodeModeActive] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("python");
  const [expandedEvaluations, setExpandedEvaluations] = useState<Record<string, boolean>>({});

  // Stable Idempotency Key per Turn (CCC-AI-0702)
  const [turnIdempotencyKey, setTurnIdempotencyKey] = useState<string>("");
  const lastQuestionIdRef = useRef<string | null>(null);

  // Lifecycle & Modals
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Voice Mode & STT (CCC-AI-0704)
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 1. Initial rehydration from server (CCC-AI-0701)
  useEffect(() => {
    if (sessionId) {
      dispatch(fetchSessionDetail(sessionId));
    }
  }, [sessionId, dispatch]);

  // Set default voice mode if session configured for VOICE
  useEffect(() => {
    if (currentSession?.mode === "VOICE") {
      setVoiceModeActive(true);
    }
  }, [currentSession?.mode]);

  // Synchronize starter code & languages
  useEffect(() => {
    if (currentSession?.current_question?.code_starter && !submittedCode) {
      setSubmittedCode(currentSession.current_question.code_starter);
    }
    if (currentSession?.preferred_language) {
      setSelectedLanguage(currentSession.preferred_language);
    }
    if (currentSession?.category === "CODING" || currentSession?.category === "DSA") {
      setCodeModeActive(true);
    }
  }, [currentSession?.current_question?.code_starter, currentSession?.preferred_language, currentSession?.category]);

  // Auto-scroll transcript on new turns
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.answers?.length, currentSession?.questions?.length]);

  // If session is already completed, redirect to report
  useEffect(() => {
    if (currentSession?.state === "COMPLETED" && sessionId) {
      navigate(`/interview/${sessionId}/report`, { replace: true });
    }
  }, [currentSession?.state, sessionId, navigate]);

  const activeQuestion = currentSession?.current_question;

  // 2. Stable Idempotency Key Maintenance (CCC-AI-0702)
  useEffect(() => {
    if (activeQuestion?.id && activeQuestion.id !== lastQuestionIdRef.current) {
      lastQuestionIdRef.current = activeQuestion.id;
      // Generate a new stable UUID for this active turn
      const randomUuid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const key = `idemp-${sessionId}-${currentSession?.current_question_index ?? 0}-${randomUuid}`;
      setTurnIdempotencyKey(key);
      setAnswerText("");
      setSubmittedCode(activeQuestion.code_starter || "");
    }
  }, [activeQuestion?.id, currentSession?.current_question_index, sessionId, activeQuestion?.code_starter]);

  // 3. Voice Session Binding & Web Speech Setup (CCC-AI-0704)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    if (voiceModeActive && sessionId && !voiceBinding) {
      dispatch(bindVoice(sessionId));
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = currentSession?.language === "hi" ? "hi-IN" : "en-US";

    recognition.onstart = () => {
      dispatch(setIsListening(true));
      setMicPermissionDenied(false);
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalSegment = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalSegment += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (interim) {
        dispatch(setInterimTranscript(interim));
      }

      if (finalSegment) {
        setAnswerText((prev) => (prev ? `${prev.trim()} ${finalSegment.trim()}` : finalSegment.trim()));
        dispatch(setInterimTranscript(""));
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicPermissionDenied(true);
        dispatch(setIsListening(false));
      }
    };

    recognition.onend = () => {
      dispatch(setIsListening(false));
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore cleanup error
      }
      dispatch(clearVoiceState());
    };
  }, [voiceModeActive, sessionId, currentSession?.language, dispatch, voiceBinding]);

  // Speak active question prompt aloud in Voice Mode if desired
  const speakPromptAloud = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      dispatch(setIsSpeaking(true));
    };

    utterance.onend = () => {
      dispatch(setIsSpeaking(false));
    };

    utterance.onerror = () => {
      dispatch(setIsSpeaking(false));
    };

    window.speechSynthesis.speak(utterance);
  }, [dispatch]);

  // Trigger TTS read on new question if voice mode is active
  useEffect(() => {
    if (voiceModeActive && activeQuestion?.prompt && currentSession?.state === "ASKING") {
      speakPromptAloud(`${activeQuestion.title}. ${activeQuestion.prompt}`);
    }
  }, [activeQuestion?.id, voiceModeActive, currentSession?.state, speakPromptAloud, activeQuestion?.title, activeQuestion?.prompt]);

  // Barge-In / Interruption Handler
  const handleInterruptAI = async () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    dispatch(setIsSpeaking(false));

    if (sessionId && voiceBinding?.voice_session_id) {
      await dispatch(interruptVoice({ sessionId, voiceId: voiceBinding.voice_session_id }));
    }

    // Immediately start listening for candidate answer
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch {
        // ignore already started
      }
    }
  };

  const handleToggleVoiceRecording = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      dispatch(setIsListening(false));
    } else {
      try {
        // Cancel any pending speech synthesis before recording
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          dispatch(setIsSpeaking(false));
        }
        recognitionRef.current.start();
      } catch {
        // ignore
      }
    }
  };

  // State handlers
  const handleStart = async () => {
    if (!sessionId) return;
    await dispatch(startSession(sessionId));
  };

  const handleTogglePause = async () => {
    if (!sessionId) return;
    if (currentSession?.state === "PAUSED") {
      await dispatch(resumeSession(sessionId));
    } else {
      await dispatch(pauseSession(sessionId));
    }
  };

  const handleComplete = async () => {
    if (!sessionId) return;
    if (window.confirm("Conclude this interview simulation early? Final coaching dossier will be synthesized.")) {
      const res = await dispatch(completeSession(sessionId));
      if (completeSession.fulfilled.match(res)) {
        navigate(`/interview/${sessionId}/report`);
      }
    }
  };

  const handleConfirmAbandon = async () => {
    if (!sessionId) return;
    await dispatch(abandonSession(sessionId));
    setShowAbandonModal(false);
    navigate("/interview");
  };

  // Turn submission with stable idempotency key
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sessionId || isSubmittingAnswer) return;
    if (!answerText.trim() && !submittedCode.trim()) return;

    // Use current stable turnIdempotencyKey (reused on retry)
    const key =
      turnIdempotencyKey ||
      `idemp-${sessionId}-${currentSession?.current_question_index ?? 0}-${Date.now()}`;

    // Stop recording if active
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    await dispatch(
      submitAnswer({
        sessionId,
        payload: {
          idempotency_key: key,
          answer_text: answerText.trim() || "See submitted code implementation.",
          submitted_code: submittedCode.trim() || undefined,
        },
      }),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleEvalExpansion = (evalId: string) => {
    setExpandedEvaluations((prev) => ({
      ...prev,
      [evalId]: !prev[evalId],
    }));
  };

  // Render: Loading Screen
  if (isLoading && !currentSession) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#B1FA63] border-t-transparent rounded-full animate-spin" />
          <span className="font-heading font-bold uppercase tracking-wider text-xs text-zinc-400">
            Rehydrating AI interview telemetry…
          </span>
        </div>
      </div>
    );
  }

  // Render: Not Found Screen
  if (!currentSession) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white p-4">
        <div className="max-w-md text-center p-8 rounded-[24px] bg-[#1F1F1F] border border-white/[0.08] space-y-4 shadow-xl">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="font-display uppercase tracking-wide text-lg text-white">
            Simulation Not Found
          </h2>
          <p className="font-sans text-xs sm:text-sm text-zinc-400">
            This interview session does not exist or your access token is invalid.
          </p>
          <button
            onClick={() => navigate("/interview")}
            className="px-5 py-2.5 bg-[#B1FA63] hover:bg-[#9de34f] text-black font-heading font-bold uppercase tracking-wider text-xs rounded-[12px] transition-all"
          >
            Return to Arena
          </button>
        </div>
      </div>
    );
  }

  // Render: Abandoned Screen (CCC-AI-0701)
  if (currentSession.state === "ABANDONED") {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white p-4">
        <div className="max-w-md text-center p-8 rounded-[24px] bg-[#1F1F1F] border border-rose-500/30 space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <X className="w-6 h-6" />
          </div>
          <h2 className="font-display uppercase tracking-wide text-xl text-white">
            Simulation Terminated
          </h2>
          <p className="font-sans text-xs sm:text-sm text-zinc-400 leading-relaxed">
            This interview was marked as <span className="text-rose-400 font-mono font-bold">ABANDONED</span>.
            No further turns can be taken and no final evaluation dossier was generated.
          </p>
          <button
            onClick={() => navigate("/interview")}
            className="px-6 py-2.5 bg-[#B1FA63] hover:bg-[#9de34f] text-black font-heading font-bold uppercase tracking-wider text-xs rounded-[12px] transition-all"
          >
            Return to Interview Hub
          </button>
        </div>
      </div>
    );
  }

  // Render: Failed Screen (CCC-AI-0701)
  if (currentSession.state === "FAILED") {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white p-4">
        <div className="max-w-md text-center p-8 rounded-[24px] bg-[#1F1F1F] border border-amber-500/30 space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="font-display uppercase tracking-wide text-xl text-white">
            Simulation Exception
          </h2>
          <p className="font-sans text-xs sm:text-sm text-zinc-400 leading-relaxed">
            The interview execution engine encountered a runtime failure. You can retry rehydration or launch a new simulation.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => sessionId && dispatch(fetchSessionDetail(sessionId))}
              className="px-4 py-2 bg-[#171717] hover:bg-[#222] border border-white/[0.08] text-white font-heading font-bold uppercase tracking-wider text-xs rounded-[12px] transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Sync
            </button>
            <button
              onClick={() => navigate("/interview")}
              className="px-5 py-2 bg-[#B1FA63] hover:bg-[#9de34f] text-black font-heading font-bold uppercase tracking-wider text-xs rounded-[12px] transition-all"
            >
              Return to Arena
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPreparing = currentSession.state === "CREATED" || currentSession.state === "PREPARING";
  const isPaused = currentSession.state === "PAUSED";
  const isEvaluating = currentSession.state === "EVALUATING" || isSubmittingAnswer;

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col font-sans">
      {/* Top Telemetry Bar */}
      <header className="sticky top-0 z-40 bg-[#171717]/95 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/interview")}
            className="font-heading font-bold uppercase tracking-wider text-xs text-zinc-400 hover:text-[#B1FA63] transition-colors"
          >
            ← Arena
          </button>
          <div className="h-4 w-px bg-white/[0.08]" />
          <div>
            <h1 className="font-display uppercase tracking-wide text-sm sm:text-base text-white flex items-center gap-2.5">
              <span>{currentSession.target_role}</span>
              <span className="font-heading font-bold uppercase tracking-wider text-[10px] px-2.5 py-0.5 rounded-full bg-[#B1FA63]/15 text-[#B1FA63] border border-[#B1FA63]/30">
                {currentSession.category}
              </span>
              {currentSession.plan_version && (
                <span className="font-mono text-[10px] text-zinc-500">
                  {currentSession.plan_version}
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mode Switcher (Voice vs Text Fallback) */}
          <div className="flex items-center rounded-full bg-[#1F1F1F] p-0.5 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setVoiceModeActive(false)}
              className={`px-2.5 py-1 rounded-full font-heading font-bold uppercase tracking-wider text-[10px] transition-all flex items-center gap-1 ${
                !voiceModeActive
                  ? "bg-[#B1FA63] text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <MessageSquare className="w-3 h-3" /> Text
            </button>
            <button
              type="button"
              onClick={() => setVoiceModeActive(true)}
              className={`px-2.5 py-1 rounded-full font-heading font-bold uppercase tracking-wider text-[10px] transition-all flex items-center gap-1 ${
                voiceModeActive
                  ? "bg-[#B1FA63] text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Mic className="w-3 h-3" /> Voice
            </button>
          </div>

          {/* State Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#1F1F1F] border border-white/[0.08] font-mono text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isPaused
                  ? "bg-amber-400"
                  : isPreparing
                  ? "bg-zinc-500"
                  : isEvaluating
                  ? "bg-blue-400 animate-ping"
                  : "bg-[#B1FA63] animate-pulse"
              }`}
            />
            <span className="text-zinc-300 font-heading font-bold uppercase tracking-wider text-[11px]">
              {isEvaluating ? "EVALUATING" : currentSession.state}
            </span>
          </div>

          {/* Turn Counter */}
          <div className="px-3 py-1 rounded-full bg-[#1F1F1F] border border-white/[0.08] font-mono text-xs text-zinc-300 tabular-nums">
            Q: {currentSession.current_question_index + 1} / {currentSession.total_questions_planned}
          </div>

          {/* Pause / Resume */}
          {!isPreparing && (
            <button
              onClick={handleTogglePause}
              className="p-2 rounded-[10px] bg-[#1F1F1F] hover:bg-[#252525] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors"
              title={isPaused ? "Resume Session" : "Pause Session"}
            >
              {isPaused ? <Play className="w-4 h-4 fill-current text-[#B1FA63]" /> : <Pause className="w-4 h-4" />}
            </button>
          )}

          {/* Conclude Early */}
          {!isPreparing && (
            <button
              onClick={handleComplete}
              className="px-3 py-1.5 rounded-[10px] bg-[#1F1F1F] hover:bg-[#252525] text-zinc-300 hover:text-white font-heading font-bold uppercase tracking-wider text-xs border border-white/[0.08] transition-colors"
            >
              Conclude
            </button>
          )}

          {/* Abandon Button */}
          <button
            onClick={() => setShowAbandonModal(true)}
            className="p-2 rounded-[10px] bg-[#1F1F1F] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-white/[0.08] transition-colors"
            title="Abandon Simulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* AI Disclosure & Operational Banner */}
      <div className="bg-[#171717] border-b border-white/[0.04] px-4 py-1.5 text-center">
        <p className="text-[11px] font-sans text-zinc-400">
          <span className="font-heading font-bold uppercase tracking-wider text-[#B1FA63] mr-1.5">
            AI Calibration:
          </span>
          Responses are evaluated in real time against objective engineering competencies. Microphone and data are used solely for practice feedback.
        </p>
      </div>

      {/* Barge-In / Speaking Telemetry Monitor (CCC-AI-0704) */}
      {isSpeaking && (
        <div className="bg-[#1F1F1F] border-b border-[#B1FA63]/30 px-4 py-2.5 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-[#B1FA63] animate-pulse" />
            <span className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63]">
              AI Interviewer is speaking…
            </span>
          </div>
          <button
            onClick={handleInterruptAI}
            className="px-3.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-full font-heading font-bold uppercase tracking-wider text-[10px] transition-colors flex items-center gap-1.5"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Interrupt AI (Barge-in)</span>
          </button>
        </div>
      )}

      {/* Mic Permission Warning */}
      {micPermissionDenied && voiceModeActive && (
        <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <MicOff className="w-4 h-4 text-rose-400" />
            <span>Microphone access was denied. Enable mic permissions in browser settings or continue in Text mode.</span>
          </div>
          <button
            onClick={() => setVoiceModeActive(false)}
            className="font-heading font-bold uppercase tracking-wider text-[10px] underline hover:text-white"
          >
            Switch to Text Mode
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left / Center Stream Column */}
        <div className="lg:col-span-3 flex flex-col space-y-6">
          {isPreparing ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 rounded-[24px] bg-[#1F1F1F] border border-white/[0.08] text-center space-y-6 my-auto shadow-2xl">
              <div className="w-16 h-16 rounded-[20px] bg-[#B1FA63]/10 border border-[#B1FA63]/25 flex items-center justify-center text-[#B1FA63] shadow-lg">
                <Brain className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-lg">
                <span className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63]">
                  Tactical Simulation
                </span>
                <h2 className="font-display uppercase tracking-wide text-2xl sm:text-3xl text-white">
                  Simulation Ready to Launch
                </h2>
                <p className="font-sans text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  The AI interviewer will formulate an adaptive agenda tailored to your target role as{" "}
                  <span className="text-white font-semibold">{currentSession.target_role}</span>.
                  Take your time to articulate trade-offs, system constraints, and failure modes.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {currentSession.focus_topics.map((topic) => (
                  <span
                    key={topic}
                    className="font-mono text-xs px-3 py-1 rounded-full bg-[#171717] border border-white/[0.08] text-zinc-300"
                  >
                    {topic}
                  </span>
                ))}
              </div>

              <button
                onClick={handleStart}
                disabled={isStartingSession}
                className="px-8 py-3 rounded-[12px] font-heading font-bold uppercase tracking-wider text-xs text-black bg-[#B1FA63] hover:bg-[#9de34f] shadow-lg shadow-[#B1FA63]/20 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isStartingSession ? (
                  <span>Formulating Agenda…</span>
                ) : (
                  <>
                    <span>Start Interview</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {/* Question & Answer History Transcript */}
              <div className="space-y-5">
                {currentSession.questions.map((q, idx) => {
                  const matchingAns = currentSession.answers.find((a) => a.question_id === q.id);
                  const matchingEval = currentSession.evaluations.find((e) => e.question_id === q.id);
                  const isCurrent = activeQuestion?.id === q.id && !matchingAns;

                  return (
                    <div
                      key={q.id}
                      className={`rounded-[24px] border transition-all ${
                        isCurrent
                          ? "bg-[#1F1F1F] border-[#B1FA63]/40 shadow-xl shadow-black/40 ring-1 ring-[#B1FA63]/20"
                          : "bg-[#1F1F1F] border-white/[0.08]"
                      } p-6 sm:p-7 space-y-4`}
                    >
                      {/* Question Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63]">
                              Turn {idx + 1}
                            </span>
                            <span className="font-heading text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#171717] border border-white/[0.08] text-zinc-400">
                              {q.topic}
                            </span>
                            {q.question_type === "FOLLOW_UP" && (
                              <span className="font-heading text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                Adaptive Follow-up
                              </span>
                            )}
                          </div>
                          <h3 className="font-display uppercase tracking-wide text-lg sm:text-xl text-white">
                            {q.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          {voiceModeActive && (
                            <button
                              type="button"
                              onClick={() => speakPromptAloud(`${q.title}. ${q.prompt}`)}
                              className="p-1.5 rounded-full bg-[#171717] hover:bg-[#252525] border border-white/[0.08] text-zinc-400 hover:text-[#B1FA63] transition-colors"
                              title="Listen to question"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {matchingEval && (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B1FA63]/15 border border-[#B1FA63]/30 text-[#B1FA63] font-mono text-xs font-bold tabular-nums">
                              <Award className="w-3.5 h-3.5" />
                              <span>{matchingEval.score}/100</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Question Prompt */}
                      <div className="font-sans text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-line bg-[#171717] p-5 rounded-[16px] border border-white/[0.08]">
                        {q.prompt}
                      </div>

                      {/* Candidate Answer (if already answered) */}
                      {matchingAns && (
                        <div className="space-y-2 pt-3 border-t border-white/[0.08]">
                          <div className="font-heading font-bold uppercase tracking-wider text-[11px] text-zinc-400 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-[#B1FA63]" /> Your Response:
                          </div>
                          <div className="font-sans text-xs sm:text-sm text-zinc-300 bg-[#171717] p-4 rounded-[16px] border border-white/[0.08] whitespace-pre-wrap leading-relaxed">
                            {matchingAns.answer_text}
                          </div>
                          {matchingAns.submitted_code && (
                            <div className="mt-2.5">
                              <div className="font-heading font-bold uppercase tracking-wider text-[11px] text-zinc-400 mb-1.5">
                                Submitted Code:
                              </div>
                              <pre className="p-4 bg-[#121212] rounded-[16px] border border-white/[0.08] text-xs font-mono text-[#B1FA63] overflow-x-auto leading-relaxed">
                                {matchingAns.submitted_code}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Turn Evaluation Accordion (if evaluated) */}
                      {matchingEval && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => toggleEvalExpansion(matchingEval.id)}
                            className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63] hover:text-[#9de34f] flex items-center gap-1.5 transition-colors"
                          >
                            {expandedEvaluations[matchingEval.id] ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                            <span>{expandedEvaluations[matchingEval.id] ? "Hide Feedback Rubric" : "View Turn Evaluation & Exemplar Answer"}</span>
                          </button>

                          {expandedEvaluations[matchingEval.id] && (
                            <div className="mt-3 p-5 rounded-[18px] bg-[#171717] border border-white/[0.08] space-y-4 text-xs">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <div className="font-heading font-bold uppercase tracking-wider text-[11px] text-[#B1FA63]">
                                    Observed Strengths:
                                  </div>
                                  <ul className="list-disc list-inside space-y-1 text-zinc-300 font-sans">
                                    {matchingEval.strengths.map((s, i) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="space-y-2">
                                  <div className="font-heading font-bold uppercase tracking-wider text-[11px] text-amber-400">
                                    Technical Gaps / Blindspots:
                                  </div>
                                  <ul className="list-disc list-inside space-y-1 text-zinc-300 font-sans">
                                    {matchingEval.gaps.map((g, i) => (
                                      <li key={i}>{g}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {matchingEval.model_answer && (
                                <div className="pt-3 border-t border-white/[0.08] space-y-1.5">
                                  <div className="font-heading font-bold uppercase tracking-wider text-[11px] text-zinc-400">
                                    Exemplar Bar-Raiser Answer:
                                  </div>
                                  <p className="font-sans text-xs text-zinc-300 leading-relaxed bg-[#121212] p-4 rounded-[14px] border border-white/[0.08]">
                                    {matchingEval.model_answer}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={transcriptEndRef} />
              </div>

              {/* Active Answer Composer (CCC-AI-0702, CCC-AI-0704) */}
              {activeQuestion && (
                <div className="sticky bottom-4 z-30 bg-[#1F1F1F]/95 backdrop-blur-md rounded-[24px] border border-white/[0.12] p-5 shadow-2xl space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCodeModeActive(false)}
                        className={`px-3.5 py-1.5 rounded-[10px] font-heading font-bold uppercase tracking-wider text-xs transition-colors flex items-center gap-1.5 ${
                          !codeModeActive
                            ? "bg-[#B1FA63] text-black"
                            : "bg-[#171717] text-zinc-400 hover:text-white border border-white/[0.08]"
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Text / Reasoning
                      </button>
                      <button
                        type="button"
                        onClick={() => setCodeModeActive(true)}
                        className={`px-3.5 py-1.5 rounded-[10px] font-heading font-bold uppercase tracking-wider text-xs transition-colors flex items-center gap-1.5 ${
                          codeModeActive
                            ? "bg-[#B1FA63] text-black"
                            : "bg-[#171717] text-zinc-400 hover:text-white border border-white/[0.08]"
                        }`}
                      >
                        <CodeIcon className="w-3.5 h-3.5" /> Code Solution
                      </button>
                    </div>

                    {/* Voice Controls Bar */}
                    {voiceModeActive && speechSupported && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleToggleVoiceRecording}
                          className={`px-3.5 py-1.5 rounded-full font-heading font-bold uppercase tracking-wider text-xs transition-all flex items-center gap-1.5 ${
                            isListening
                              ? "bg-rose-500 text-white animate-pulse"
                              : "bg-[#171717] hover:bg-[#252525] text-zinc-300 border border-white/[0.08]"
                          }`}
                        >
                          {isListening ? (
                            <>
                              <Square className="w-3.5 h-3.5 fill-current" />
                              <span>Listening… (Click to Pause)</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-3.5 h-3.5 text-[#B1FA63]" />
                              <span>Start Speaking</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {codeModeActive && (
                      <div className="font-heading font-bold uppercase tracking-wider text-[11px] text-zinc-400">
                        Language: <span className="text-[#B1FA63]">{selectedLanguage}</span>
                      </div>
                    )}
                  </div>

                  {/* Provisional Voice Streaming Bubble (CCC-AI-0704) */}
                  {isListening && interimTranscript && (
                    <div className="p-3 bg-[#171717] rounded-[14px] border border-[#B1FA63]/30 text-xs text-zinc-300 flex items-center gap-2.5">
                      <Radio className="w-3.5 h-3.5 text-[#B1FA63] animate-pulse shrink-0" />
                      <div className="font-mono text-zinc-400 text-[11px] truncate">
                        <span className="text-[#B1FA63]">Speech stream:</span> {interimTranscript}
                      </div>
                    </div>
                  )}

                  {!codeModeActive ? (
                    <textarea
                      rows={4}
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        voiceModeActive
                          ? "Voice transcription will stream here in real time, or type your response manually... (Press ⌘+Enter to submit)"
                          : "Type your explanation, architectural trade-offs, and computational approach... (Press ⌘+Enter to submit)"
                      }
                      className="w-full p-4 rounded-[16px] bg-[#171717] border border-white/[0.08] font-sans text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#B1FA63]/50 focus:ring-1 focus:ring-[#B1FA63]/50 transition-all resize-y"
                    />
                  ) : (
                    <div className="space-y-2.5">
                      <textarea
                        rows={8}
                        value={submittedCode}
                        onChange={(e) => setSubmittedCode(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`// Write your ${selectedLanguage} solution here...`}
                        className="w-full p-4 rounded-[16px] bg-[#121212] border border-white/[0.08] font-mono text-xs sm:text-sm text-[#B1FA63] placeholder-zinc-600 focus:outline-none focus:border-[#B1FA63]/50 focus:ring-1 focus:ring-[#B1FA63]/50 resize-y"
                      />
                      <input
                        type="text"
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="Optional brief notes or algorithmic complexity walkthrough..."
                        className="w-full px-4 py-2 rounded-[12px] bg-[#171717] border border-white/[0.08] font-sans text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#B1FA63]/50 focus:ring-1 focus:ring-[#B1FA63]/50"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold uppercase tracking-wider text-[11px] text-zinc-500 hidden sm:inline">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-[#171717] border border-white/[0.08] text-zinc-300 font-mono">⌘/Ctrl + Enter</kbd> to submit turn
                      </span>
                      {turnIdempotencyKey && (
                        <span className="text-[10px] font-mono text-zinc-600 hidden md:inline truncate max-w-[200px]" title={turnIdempotencyKey}>
                          key: {turnIdempotencyKey.substring(0, 18)}…
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSubmit()}
                      disabled={isSubmittingAnswer || (!answerText.trim() && !submittedCode.trim())}
                      className="px-6 py-2.5 rounded-[12px] font-heading font-bold uppercase tracking-wider text-xs text-black bg-[#B1FA63] hover:bg-[#9de34f] shadow-md shadow-[#B1FA63]/20 disabled:opacity-40 transition-all flex items-center gap-2 ml-auto"
                    >
                      {isSubmittingAnswer ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>Evaluating response…</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Turn</span>
                          <Send className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Sidebar: Agenda & Telemetry Drawer */}
        <div className="space-y-5">
          {/* Agenda Checklist */}
          <div className="p-5 rounded-[24px] bg-[#1F1F1F] border border-white/[0.08] space-y-4">
            <h3 className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63]">
              Simulation Agenda
            </h3>
            <div className="space-y-2">
              {currentSession.questions.map((q, i) => {
                const isAnswered = currentSession.answers.some((a) => a.question_id === q.id);
                const isCurrent = activeQuestion?.id === q.id && !isAnswered;

                return (
                  <div
                    key={q.id}
                    className={`flex items-start gap-3 p-3 rounded-[14px] text-xs transition-colors ${
                      isCurrent
                        ? "bg-[#B1FA63]/10 text-white border border-[#B1FA63]/30"
                        : isAnswered
                        ? "bg-[#171717] text-zinc-400 border border-white/[0.04]"
                        : "bg-[#171717] text-zinc-500 border border-white/[0.04]"
                    }`}
                  >
                    {isAnswered ? (
                      <CheckCircle2 className="w-4 h-4 text-[#B1FA63] shrink-0 mt-0.5" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-zinc-600 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                    )}
                    <div className="leading-tight space-y-0.5">
                      <div className="font-bold text-white font-sans">{q.title}</div>
                      <div className="font-heading font-bold uppercase tracking-wider text-[10px] text-zinc-400">
                        {q.topic}
                      </div>
                    </div>
                  </div>
                );
              })}
              {currentSession.questions.length === 0 && (
                <div className="font-sans text-xs text-zinc-500 italic p-2">
                  Agenda will populate upon starting session.
                </div>
              )}
            </div>
          </div>

          {/* Candidate Calibration Card */}
          <div className="p-5 rounded-[24px] bg-[#1F1F1F] border border-white/[0.08] space-y-3.5 text-xs">
            <h3 className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63]">
              Candidate Profile
            </h3>
            <div className="space-y-2 text-zinc-300">
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-zinc-400 font-sans">Target Role:</span>
                <span className="font-semibold text-white font-sans">{currentSession.target_role}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-zinc-400 font-sans">Seniority:</span>
                <span className="font-mono capitalize text-zinc-200">{currentSession.experience_level.toLowerCase()}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-zinc-400 font-sans">Difficulty:</span>
                <span className="font-mono text-zinc-200">{currentSession.difficulty}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-zinc-400 font-sans">Mode:</span>
                <span className="font-mono text-[#B1FA63] font-bold">{voiceModeActive ? "VOICE" : "TEXT"}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-400 font-sans">Duration:</span>
                <span className="font-mono text-zinc-200">{currentSession.duration_minutes} min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Abandon Confirmation Modal (CCC-AI-0701) */}
      {showAbandonModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-[#1F1F1F] rounded-[24px] border border-rose-500/30 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display uppercase tracking-wide text-base text-white">
                  Abandon Simulation?
                </h3>
                <p className="font-sans text-xs text-zinc-400">
                  This action is irreversible.
                </p>
              </div>
            </div>

            <p className="font-sans text-xs text-zinc-300 leading-relaxed bg-[#171717] p-4 rounded-[16px] border border-white/[0.08]">
              Abandoning this interview simulation will immediately terminate the session. No final evaluation dossier or competency report will be generated.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAbandonModal(false)}
                className="px-4 py-2 rounded-[12px] bg-[#171717] hover:bg-[#252525] border border-white/[0.08] text-xs font-heading font-bold uppercase tracking-wider text-zinc-300 transition-colors"
              >
                Keep Practicing
              </button>
              <button
                type="button"
                onClick={handleConfirmAbandon}
                className="px-5 py-2 rounded-[12px] bg-rose-600 hover:bg-rose-500 text-xs font-heading font-bold uppercase tracking-wider text-white shadow-md shadow-rose-600/30 transition-colors"
              >
                Abandon Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
