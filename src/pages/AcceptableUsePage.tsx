import React from "react";
import { LegalPolicyPageLayout } from "@/components/legal/LegalPolicyPageLayout";

const DEFAULT_ACCEPTABLE_USE_CONTENT = `
### 1. Permitted Uses
The platform is designed exclusively for competitive algorithm problem-solving, technical skill validation, and AI-driven mock interviews.

### 2. Prohibited System Activity
Users shall not:
- Attempt to exploit, probe, or vulnerability-scan the API, judge cluster, or database infrastructure.
- Execute fork bombs, memory-exhaustion exploits, or filesystem traversal attacks inside the code sandbox.
- Interfere with network connectivity or attempt socket connections from inside the judge container.
- Reverse engineer or automate platform access via unapproved headless scraping bots.

### 3. Rate Limiting & Resource Consumption
Automated scraping or abusive request bursts are intercepted by Cloudflare and application-level token bucket rate limiters. Accounts generating malicious traffic will have their tokens revoked immediately.

### 4. Reporting Vulnerabilities
If you discover a security vulnerability in the platform or sandbox isolation layer, report it responsibly to security@chaoscomputerclub.in.
`;

export function AcceptableUsePage() {
  return (
    <LegalPolicyPageLayout
      policyType="ACCEPTABLE_USE"
      defaultTitle="Acceptable Use Policy"
      defaultVersion="1.0.0"
      defaultContent={DEFAULT_ACCEPTABLE_USE_CONTENT}
    />
  );
}

export default AcceptableUsePage;
