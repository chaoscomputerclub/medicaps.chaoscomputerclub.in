/**
 * Chaos Computer Club Medi-Caps — Candidate Resume Intelligence Modal
 * Upload, provenance fact review, corrections, consent, and removal.
 * Styled in 100% fidelity to the CCC Medi-Caps dark tactical theme.
 */

import React, { useState, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setResumeModalOpen,
  uploadResume,
  updateResumeFacts,
  consentResume,
  deleteResume,
} from "@/store/slices/interviewSlice";
import type { ResumeFactUpdateRequest } from "../types";
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit2,
  ShieldCheck,
  Sparkles,
  Lock,
  Check,
  Ban,
  Loader2,
} from "lucide-react";

export function ResumeManagerModal() {
  const dispatch = useAppDispatch();
  const { currentResume, isUploadingResume } = useAppSelector((state) => state.interview);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [correctedValue, setCorrectedValue] = useState<string>("");
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, ResumeFactUpdateRequest>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);

  const asset = currentResume?.asset;
  const facts = currentResume?.facts || [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File exceeds maximum allowed size of 5MB.");
      return;
    }
    setUploadError(null);
    await dispatch(uploadResume(file));
  };

  const handleStatusChange = (factId: string, status: "CONFIRMED" | "REJECTED") => {
    setPendingUpdates((prev) => ({
      ...prev,
      [factId]: {
        fact_id: factId,
        candidate_status: status,
      },
    }));
  };

  const handleStartCorrection = (factId: string, currentValue: string) => {
    setEditingFactId(factId);
    setCorrectedValue(currentValue);
  };

  const handleSaveCorrection = (factId: string) => {
    if (!correctedValue.trim()) return;
    setPendingUpdates((prev) => ({
      ...prev,
      [factId]: {
        fact_id: factId,
        candidate_status: "CORRECTED",
        candidate_corrected_value: correctedValue.trim(),
      },
    }));
    setEditingFactId(null);
    setCorrectedValue("");
  };

  const handleCommitUpdates = async () => {
    if (!asset || Object.keys(pendingUpdates).length === 0) return;
    await dispatch(
      updateResumeFacts({
        assetId: asset.asset_id,
        updates: Object.values(pendingUpdates),
      }),
    );
    setPendingUpdates({});
  };

  const handleToggleConsent = async () => {
    if (!asset) return;
    const isCurrentlyConfirmed = asset.consent_status === "CONFIRMED";
    await dispatch(
      consentResume({
        assetId: asset.asset_id,
        consent: !isCurrentlyConfirmed,
      }),
    );
  };

  const handleDeleteAsset = async () => {
    if (!asset) return;
    if (window.confirm("Permanently delete this resume asset and all extracted facts?")) {
      await dispatch(deleteResume(asset.asset_id));
      setPendingUpdates({});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#1F1F1F] border border-white/[0.08] rounded-[24px] shadow-2xl p-6 sm:p-8 text-white space-y-6"
        style={{ overscrollBehavior: "contain" }}
      >
        {/* Close Button */}
        <button
          onClick={() => dispatch(setResumeModalOpen(false))}
          className="absolute top-5 right-5 p-2 rounded-[8px] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          aria-label="Close resume modal"
        >
          <X className="size-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center size-10 rounded-[12px] bg-[#B1FA63]/15 border border-[#B1FA63]/30 text-[#B1FA63]">
            <FileText className="size-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-display uppercase tracking-wide text-white">
              Resume Intelligence & Provenance
            </h2>
            <p className="text-xs font-sans text-zinc-400">
              Privately extract and review verified facts to calibrate AI interview questions without prompt leakage.
            </p>
          </div>
        </div>

        {/* Upload State / Asset Info */}
        {!asset ? (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 sm:p-12 rounded-[20px] border-2 border-dashed border-white/[0.12] hover:border-[#B1FA63]/50 bg-[#171717] transition-all text-center space-y-3 cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.docx,application/pdf,text/plain"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="size-12 rounded-full bg-[#1F1F1F] border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-400 group-hover:text-[#B1FA63] group-hover:border-[#B1FA63]/30 transition-all">
                {isUploadingResume ? (
                  <Loader2 className="size-6 animate-spin text-[#B1FA63]" />
                ) : (
                  <UploadCloud className="size-6" />
                )}
              </div>
              <div className="space-y-1">
                <div className="font-heading font-bold uppercase tracking-wider text-xs text-zinc-200">
                  {isUploadingResume ? "Scanning and parsing resume…" : "Upload Candidate Resume"}
                </div>
                <p className="text-xs font-sans text-zinc-400">
                  PDF or TXT up to 5MB. Scanned for vulnerabilities and parsed safely.
                </p>
              </div>
            </div>
            {uploadError && (
              <div className="p-3 rounded-[10px] bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-sans">
                {uploadError}
              </div>
            )}
            <div className="p-4 rounded-[14px] bg-[#171717] border border-white/[0.06] text-xs text-zinc-400 space-y-1.5 font-sans">
              <div className="flex items-center gap-1.5 text-[#B1FA63] font-heading font-bold uppercase tracking-wider text-[11px]">
                <ShieldCheck className="size-3.5" />
                <span>Zero Prompt Leakage Guarantee</span>
              </div>
              <p>
                Candidate direct identifiers (PRN, personal phone numbers, and student emails) are stripped before
                reaching any LLM prompt. Only confirmed, reviewed facts are used.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Asset Metadata Banner */}
            <div className="p-4 rounded-[16px] bg-[#171717] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText className="size-8 text-[#B1FA63] shrink-0" />
                <div>
                  <div className="font-sans font-semibold text-white text-sm">{asset.original_filename}</div>
                  <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-2 mt-0.5">
                    <span>{(asset.size_bytes / 1024).toFixed(1)} KB</span>
                    <span>•</span>
                    <span className="text-[#B1FA63] uppercase">{asset.scan_status}</span>
                    <span>•</span>
                    <span>{new Date(asset.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {/* Consent Toggle */}
                <button
                  type="button"
                  onClick={handleToggleConsent}
                  className={`h-8 px-3 rounded-[8px] text-[11px] font-heading font-bold uppercase tracking-wider border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    asset.consent_status === "CONFIRMED"
                      ? "bg-[#B1FA63]/15 text-[#B1FA63] border-[#B1FA63]/30"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  }`}
                >
                  <Lock className="size-3" />
                  <span>
                    {asset.consent_status === "CONFIRMED" ? "Consent Granted" : "Consent Revoked"}
                  </span>
                </button>

                {/* Delete Asset */}
                <button
                  type="button"
                  onClick={handleDeleteAsset}
                  className="p-2 rounded-[8px] hover:bg-red-500/15 text-zinc-400 hover:text-red-400 border border-white/[0.06] transition-colors cursor-pointer"
                  title="Delete resume asset"
                  aria-label="Delete resume asset"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Extracted Facts & Provenance Review */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold uppercase tracking-wider text-xs text-[#B1FA63] flex items-center gap-2">
                  <Sparkles className="size-3.5" />
                  <span>Extracted Provenance Facts ({facts.length})</span>
                </h3>
                {Object.keys(pendingUpdates).length > 0 && (
                  <button
                    type="button"
                    onClick={handleCommitUpdates}
                    className="h-7 px-3 rounded-[8px] bg-[#B1FA63] hover:bg-[#9de34f] text-black font-heading font-bold uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
                  >
                    Save {Object.keys(pendingUpdates).length} Changes
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {facts.map((fact) => {
                  const pending = pendingUpdates[fact.id];
                  const currentStatus = pending ? pending.candidate_status : fact.candidate_status;
                  const displayValue =
                    pending?.candidate_corrected_value || fact.candidate_corrected_value || fact.normalized_value;
                  const isEditing = editingFactId === fact.id;

                  return (
                    <div
                      key={fact.id}
                      className="p-3.5 rounded-[14px] bg-[#171717] border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-[#1F1F1F] text-[#B1FA63] border border-white/[0.06]">
                            {fact.fact_type}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500">
                            Confidence: {Math.round(fact.extraction_confidence * 100)}%
                          </span>
                        </div>

                        {isEditing ? (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={correctedValue}
                              onChange={(e) => setCorrectedValue(e.target.value)}
                              className="px-2.5 py-1 rounded-[6px] bg-[#1F1F1F] border border-[#B1FA63] text-white text-xs font-sans focus:outline-none flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveCorrection(fact.id)}
                              className="px-2 py-1 rounded-[6px] bg-[#B1FA63] text-black font-heading font-bold uppercase text-[10px]"
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFactId(null)}
                              className="text-zinc-400 hover:text-white text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="font-sans font-medium text-zinc-200 truncate">{displayValue}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(fact.id, "CONFIRMED")}
                          className={`h-7 px-2.5 rounded-[6px] text-[10px] font-heading font-bold uppercase tracking-wider border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                            currentStatus === "CONFIRMED"
                              ? "bg-[#B1FA63]/20 text-[#B1FA63] border-[#B1FA63]/40"
                              : "bg-[#1F1F1F] text-zinc-400 border-white/[0.04] hover:text-white"
                          }`}
                        >
                          <Check className="size-3" />
                          <span>Confirm</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartCorrection(fact.id, displayValue)}
                          className="h-7 px-2.5 rounded-[6px] text-[10px] font-heading font-bold uppercase tracking-wider bg-[#1F1F1F] text-zinc-300 hover:text-white border border-white/[0.04] transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="size-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStatusChange(fact.id, "REJECTED")}
                          className={`h-7 px-2.5 rounded-[6px] text-[10px] font-heading font-bold uppercase tracking-wider border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                            currentStatus === "REJECTED"
                              ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                              : "bg-[#1F1F1F] text-zinc-400 border-white/[0.04] hover:text-rose-400"
                          }`}
                        >
                          <Ban className="size-3" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={() => dispatch(setResumeModalOpen(false))}
            className="h-9 px-5 rounded-[10px] bg-[#B1FA63] text-black font-heading font-bold uppercase tracking-wider text-xs hover:bg-[#9de34f] transition-colors cursor-pointer"
          >
            Close & Return
          </button>
        </div>
      </div>
    </div>
  );
}

