import React from "react";
import { LegalPolicyPageLayout } from "@/components/legal/LegalPolicyPageLayout";

const DEFAULT_TERMS_CONTENT = `
### 1. Purpose and Acceptance
These Terms of Service ("Terms") govern access to and use of the competitive programming arena, AI technical interview platform, and engineering assessment infrastructure operated by Chaos Computer Club ("CCC", "we", "our").

By registering an account, submitting code to sandboxed judges, participating in contests, or undergoing AI technical interviews, you agree to these Terms.

### 2. User Accounts & Identity
Users may register with personal, academic, or professional email addresses. If you authenticate with an email matching an authorized organization domain (such as Medi-Caps University), you are automatically provisioned membership in the corresponding organization workspace.

### 3. Sandboxed Execution & Security
Code submitted to the platform executes inside restricted, unprivileged Linux cgroups v2 sandboxes. Users agree never to attempt privilege escalation, network escaping, judge interference, or hostile denial of service.

### 4. Integrity and Fair Play
Plagiarism, multi-accounting, sharing solutions during live rounds, and unauthorized automated tooling are strictly forbidden. Infractions result in immediate disqualification and rating forfeiture.

### 5. Intellectual Property
You retain ownership of original code and algorithm solutions authored during open practice. By participating in sponsored contests or institutional screenings, you grant the hosting organization license to evaluate and review your submissions.
`;

export function TermsPage() {
  return (
    <LegalPolicyPageLayout
      policyType="TERMS_OF_SERVICE"
      defaultTitle="Platform Terms of Service"
      defaultVersion="1.0.0"
      defaultContent={DEFAULT_TERMS_CONTENT}
    />
  );
}

export default TermsPage;
