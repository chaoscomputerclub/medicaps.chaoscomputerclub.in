import React from "react";
import { LegalPolicyPageLayout } from "@/components/legal/LegalPolicyPageLayout";

const DEFAULT_PRIVACY_CONTENT = `
### 1. Data Collection
We collect minimal information necessary to deliver competitive programming assessments and AI interviews:
- Email address (for authentication and workspace association)
- Chosen username/handle and profile metadata
- Code submissions, execution runtimes, memory profiles, and testcase pass rates
- AI interview audio streams, transcripts, and evaluation metrics (where initiated by the user)
- Security audit logs: IP address, user-agent, and transaction timestamps

### 2. Purpose of Processing
Your data is processed strictly to:
- Authenticate and maintain your user session
- Judge and score algorithmic code submissions
- Compute Elo ratings, rankings, and public leaderboards
- Maintain platform integrity, audit trails, and anti-cheat defenses
- Provide technical interview practice and performance analytics

### 3. Data Retention & Sandboxing
Code submissions are evaluated in ephemeral sandbox environments and stored securely. Source code is never sold or shared with third-party advertisers. Institutional workspaces (e.g. Medi-Caps University) only access contest and assessment data relevant to their registered events.

### 4. User Rights
You have the right to request access to your stored profile data, export your submission history, or request account closure.
`;

export function PrivacyPolicyPage() {
  return (
    <LegalPolicyPageLayout
      policyType="PRIVACY_POLICY"
      defaultTitle="Platform Privacy Policy"
      defaultVersion="1.0.0"
      defaultContent={DEFAULT_PRIVACY_CONTENT}
    />
  );
}

export default PrivacyPolicyPage;
