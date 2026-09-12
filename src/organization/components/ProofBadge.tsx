import { BadgeCheck, Fingerprint, ShieldCheck } from "lucide-react";
import type { TrustProof } from "../data/types";
import { ProofBadgeSkeleton } from "./skeletons";

export function ProofBadge({
  proof,
  compact = false,
  loading = false,
}: {
  proof?: TrustProof;
  compact?: boolean;
  loading?: boolean;
}) {
  if (loading || !proof) {
    return <ProofBadgeSkeleton compact={compact} />;
  }

  return (
    <article className="proof-badge">
      <div className="proof-header">
        <div>
          <span className="proof-seal"><ShieldCheck size={18} /> CCC VERIFIED</span>
          <h3>{proof.contest_title}</h3>
        </div>
        <BadgeCheck className="accent-icon" size={28} />
      </div>
      <dl className="proof-grid">
        <div>
          <dt>Certificate</dt>
          <dd>{proof.certificate_id}</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd>Rank {proof.rank} · {proof.score} pts</dd>
        </div>
        {!compact && (
          <>
            <div>
              <dt>Attendance stamp</dt>
              <dd>{proof.attendance_stamp}</dd>
            </div>
            <div>
              <dt>Proctor stamp</dt>
              <dd>{proof.proctor_stamp}</dd>
            </div>
          </>
        )}
      </dl>
      <div className="hash-row">
        <Fingerprint size={15} />
        <code>{proof.sha256_digest}</code>
      </div>
      <footer>
        <span>{new Date(proof.issued_at).toLocaleDateString("en-IN")}</span>
        <strong>{proof.status.toUpperCase()}</strong>
      </footer>
    </article>
  );
}
