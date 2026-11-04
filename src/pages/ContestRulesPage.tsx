import React from "react";
import { LegalPolicyPageLayout } from "@/components/legal/LegalPolicyPageLayout";

const DEFAULT_CONTEST_RULES_CONTENT = `
### 1. General Competition Protocol
Contests hosted on Chaos Computer Club are timed algorithmic and system design competitions. Unless explicitly designated as a team contest, all rounds are strictly individual.

### 2. Fair Play & Prohibited Behaviors
- **Zero External Assistance:** Using unauthorized generative AI, third-party solvers, or communication channels during live rounds is strictly prohibited.
- **Single Account Rule:** Each competitor must participate under a single registered account. Competing under multiple handles results in permanent disqualification.
- **No Solution Leaking:** Sharing testcases, solution logic, or reverse-engineered problem details before the official contest editorial is published constitutes an integrity violation.

### 3. Evaluation & Tie-Breaking
- Ranking is determined by total score (points awarded per passed problem).
- Ties are broken by penalty time (measured from contest start time plus penalty minutes per rejected submission).
- System tests and hidden edge cases run after live rounds determine final official standing.

### 4. Process Sandboxing & Integrity Sentinels
All submissions are executed in hardware-isolated Linux cgroup v2 namespaces. Anti-cheat sentinels analyze keystroke cadence, window focus deviations, and tokenized syntax trees for cross-cadet plagiarism.
`;

export function ContestRulesPage() {
  return (
    <LegalPolicyPageLayout
      policyType="CONTEST_RULES"
      defaultTitle="Official Contest Rules & Integrity Guidelines"
      defaultVersion="1.0.0"
      defaultContent={DEFAULT_CONTEST_RULES_CONTENT}
    />
  );
}

export default ContestRulesPage;
