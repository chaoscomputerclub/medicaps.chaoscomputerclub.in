import React from "react";
import { LegalPolicyPageLayout } from "@/components/legal/LegalPolicyPageLayout";

const DEFAULT_CODE_OF_CONDUCT_CONTENT = `
### 1. Our Commitment
Chaos Computer Club is committed to providing a safe, respectful, and merit-based environment for competitive coders, security researchers, and software engineers worldwide.

### 2. Expected Standards
- Treat fellow competitors, community members, and moderators with dignity and mutual respect.
- Provide constructive code reviews, discussion comments, and interview feedback.
- Respect diverse backgrounds, skill levels, and learning journeys.

### 3. Unacceptable Behavior
- Harassment, discriminatory slurs, intimidation, or derogatory commentary.
- Disruptive behavior in public chatrooms, contest discussion threads, or interview lobbies.
- Defaming competitors or publishing personal identifying information (doxxing).

### 4. Enforcement
Violations of this Code of Conduct may result in formal warnings, temporary discussion bans, contest disqualification, or permanent expulsion from the arena.
`;

export function CodeOfConductPage() {
  return (
    <LegalPolicyPageLayout
      policyType="CODE_OF_CONDUCT"
      defaultTitle="Community Code of Conduct"
      defaultVersion="1.0.0"
      defaultContent={DEFAULT_CODE_OF_CONDUCT_CONTENT}
    />
  );
}

export default CodeOfConductPage;
