# Resume Intelligence Contract

## Scope

Turn candidate resume upload into a consent-aware, reviewable source of interview context. Existing `resume_notes` and candidate context builder are not a substitute for this workflow.

## Processing pipeline

`UPLOAD → VALIDATE → MALWARE_SCAN → STORE_PRIVATE → EXTRACT_TEXT → PARSE_FACTS → REVIEW_REQUIRED → CONFIRMED/REJECTED → AVAILABLE_FOR_INTERVIEW`

## Upload rules

- Allowlist formats (PDF, DOCX, TXT) based on actual parser support.
- Verify MIME by content sniffing; filename extension alone is insufficient.
- Configure max file size and max page count.
- Reject encrypted/unsupported/corrupt files with actionable error.
- Malware scan before parsing.
- Store in private object storage with opaque key and no public URL.
- Never execute embedded macros/scripts.
- Parse in a constrained worker/process with CPU, memory and timeout limits.

## Extracted fact categories

- Skills and technologies
- Employment/experience
- Projects
- Education
- Achievements
- Responsibilities and impact claims

Each fact includes:
- source asset
- source page/section or character range
- extraction confidence
- parser/model version
- candidate status
- candidate correction
- timestamps.

## Candidate review

The UI must allow:
- review each extracted fact;
- edit incorrect facts;
- confirm or reject;
- remove entire resume;
- grant/revoke use consent.

Only confirmed facts with active consent are eligible for interview context. Candidate notes entered directly are also marked as candidate-provided, not externally verified.

## Prompt injection and data protection

Resume text can contain hostile instructions. Treat it as untrusted evidence only. It must not override system/developer instructions or workflow policy.

Remove direct identifiers before prompt construction. The current context builder includes member PRN; this must be removed.

## Context assembly

Prioritize:
1. confirmed facts relevant to target role;
2. confirmed projects relevant to interview topic;
3. declared skills;
4. candidate-selected job description requirements.

Hard cap the context by tokens, not only characters. Keep provenance references outside model-facing text so report evidence can point to source records without exposing internal IDs.

## Deletion

Deletion must remove:
- original file;
- extracted text and fact rows;
- embeddings/vector entries if added;
- cached context;
- references from active sessions according to policy.

For an active interview, explain whether the current session snapshot remains available or is purged immediately. Document and enforce one policy.
