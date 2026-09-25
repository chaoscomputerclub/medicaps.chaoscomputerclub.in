import { QRCodeSVG } from "qrcode.react";
import { MapPin, ScanLine } from "lucide-react";
import type { CampusPass } from "../data/types";
import { formatContestDate } from "./ui";
import { CampusPassSkeleton } from "./skeletons";

export function CampusPassCard({
  pass,
  loading = false,
}: {
  pass?: CampusPass;
  loading?: boolean;
}) {
  if (loading) {
    return <CampusPassSkeleton />;
  }

  if (!pass || !pass.pass_code || pass.pass_code === "NONE") {
    return (
      <article className="campus-pass flex flex-col items-center justify-center text-center p-8 border border-dashed border-[#222]">
        <header className="w-full flex justify-between font-mono text-xs text-zinc-400">
          <span>CCC / MEDI-CAPS</span>
          <strong>CAMPUS ACCESS PASS</strong>
        </header>
        <div className="my-auto py-10 flex flex-col items-center gap-2">
          <ScanLine size={36} className="text-zinc-500" />
          <h3 className="text-white font-mono text-sm font-bold mt-2">No Active Gate Pass</h3>
          <p className="text-zinc-400 font-mono text-xs max-w-xs">
            Appear in an online screening round to qualify among the Top 30 for an offline physical
            lab seat pass.
          </p>
        </div>
        <footer className="w-full text-center text-zinc-400 font-mono text-[10px]">
          OFFLINE ADMISSION • SINGLE ENTRY
        </footer>
      </article>
    );
  }

  return (
    <article className="campus-pass">
      <div className="pass-cut pass-cut-left" />
      <div className="pass-cut pass-cut-right" />
      <header>
        <span>CCC / MEDI-CAPS</span>
        <strong>CAMPUS ACCESS PASS</strong>
      </header>
      <div className="pass-body">
        <div>
          <p className="kicker">Registered delegate</p>
          <h3>{pass.member_name}</h3>
          <code>
            @{pass.handle} · {pass.prn_hash}
          </code>
          <dl>
            <div>
              <dt>Contest</dt>
              <dd>{pass.contest_title}</dd>
            </div>
            <div>
              <dt>Seat</dt>
              <dd>{pass.seat}</dd>
            </div>
            <div>
              <dt>
                <MapPin size={12} /> Venue
              </dt>
              <dd>{pass.venue}</dd>
            </div>
            <div>
              <dt>Check-in opens</dt>
              <dd>{formatContestDate(pass.check_in_opens_at)}</dd>
            </div>
          </dl>
        </div>
        <div className="pass-qr">
          <QRCodeSVG
            value={pass.pass_code}
            size={116}
            bgColor="transparent"
            fgColor="currentColor"
            level="H"
          />
          <span>
            <ScanLine size={13} />
            {pass.status}
          </span>
        </div>
      </div>
      <footer>
        <code>{pass.pass_code}</code>
        <span>OFFLINE • SINGLE ENTRY</span>
      </footer>
    </article>
  );
}
