import { VerifySkeleton } from "@/organization/components/skeletons";
import { createFileRoute } from "@tanstack/react-router";
import { Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setVerifyTerm, setVerifySubmitted } from "@/store/slices/portalSlice";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProofBadge } from "@/organization/components/ProofBadge";
import { portalQueries } from "@/organization/data/queries";
const q = portalQueries.proofs();
export const Route = createFileRoute("/portal/verify")({
  validateSearch: (s: Record<string, unknown>) => ({
    proof: typeof s["proof"] === "string" ? s["proof"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Verify a Contest Result — CCC Medi-Caps" },
      {
        name: "description",
        content:
          "Verify CCC Medi-Caps contest certificates against signed attendance and proctor records.",
      },
      { property: "og:title", content: "CCC Result Verification" },
      {
        property: "og:description",
        content: "Check a contest proof by certificate ID or SHA-256 digest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  pendingComponent: VerifySkeleton,
  component: Verify,
});
function Verify() {
  const { data: proofs } = useSuspenseQuery(q);
  const search = Route.useSearch();
  const dispatch = useAppDispatch();
  const term = useAppSelector((s) => s.portal.verifyTerm);
  const submitted = useAppSelector((s) => s.portal.verifySubmitted);
  useEffect(() => {
    if (search.proof) {
      dispatch(setVerifyTerm(search.proof));
      dispatch(setVerifySubmitted(search.proof));
    }
  }, [search.proof, dispatch]);
  const result = submitted
    ? proofs.find(
        (p) =>
          p.certificate_id.toLowerCase() === submitted.toLowerCase() ||
          p.sha256_digest.toLowerCase() === submitted.toLowerCase(),
      )
    : undefined;
  return (
    <div className="page-wrap verify-wrap">
      <header className="page-header">
        <div>
          <p className="kicker">Public trust console</p>
          <h1>Verify a result.</h1>
          <p>Check a certificate ID or complete SHA-256 digest against the sealed campus record.</p>
        </div>
        <ShieldCheck className="header-glyph" />
      </header>
      <form
        className="verify-form"
        onSubmit={(e) => {
          e.preventDefault();
          dispatch(setVerifySubmitted(term.trim()));
        }}
      >
        <label htmlFor="proof">Certificate ID / SHA-256 digest</label>
        <div>
          <Input
            id="proof"
            value={term}
            onChange={(e) => dispatch(setVerifyTerm(e.target.value))}
            placeholder="CCC-MED-..."
          />
          <Button type="submit">
            <Search /> Verify
          </Button>
        </div>
        <small>Enter an official certificate ID or complete SHA-256 digest.</small>
      </form>
      {!submitted && (
        <div className="border border-dashed border-[var(--line)] bg-[var(--surface-2)]/40 p-8 text-center my-6">
          <ShieldCheck className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Awaiting Verification Query
          </h3>
          <p className="font-mono text-[0.6875rem] text-muted-foreground/70 max-w-md mx-auto mt-1 leading-relaxed">
            Enter an official certificate ID or a 64-character SHA-256 digest above to validate authentic contest attendance, seat, and proctored records.
          </p>
        </div>
      )}
      {submitted &&
        (result ? (
          <div className="verification-result valid">
            <div className="verification-status">
              <ShieldCheck />
              <div>
                <span>AUTHENTIC RECORD</span>
                <h2>Proof chain validated.</h2>
                <p>
                  The result matches the signed attendance, seat, proctor, and contest session
                  record.
                </p>
              </div>
            </div>
            <ProofBadge proof={result} />
          </div>
        ) : (
          <div className="verification-result invalid">
            <ShieldAlert />
            <div>
              <span>NO MATCH</span>
              <h2>Record could not be verified.</h2>
              <p>Check the identifier exactly. An absent record is not proof of participation.</p>
            </div>
          </div>
        ))}
    </div>
  );
}
