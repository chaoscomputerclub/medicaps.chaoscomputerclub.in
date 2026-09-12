import { ProfileSkeleton } from '@/organization/components/skeletons';
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Award, ExternalLink, LockKeyhole, ShieldCheck, Zap } from "lucide-react";
import { CampusPassCard } from "@/organization/components/CampusPassCard";
import { ProofBadge } from "@/organization/components/ProofBadge";
import { RatingChart } from "@/organization/components/RatingChart";
import { Metric, SectionHeader, TierBadge } from "@/organization/components/ui";
import { portalQueries } from "@/organization/data/queries";
const qs=[portalQueries.member(),portalQueries.ratingHistory(),portalQueries.recentBattles(),portalQueries.campusPass(),portalQueries.proofs(),portalQueries.achievements()] as const;
import { redirect } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth";

export const Route=createFileRoute("/portal/profile")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/auth" });
    }
  },
  head:()=>({meta:[{title:"Competitive Profile — CCC Medi-Caps"},{name:"description",content:"Personal rating, offline contest history, campus pass and verified result proofs."},{property:"og:title",content:"Competitive Profile — CCC Medi-Caps"},{property:"og:description",content:"A member's verified offline competitive programming record."},{property:"og:type",content:"profile"},{name:"twitter:card",content:"summary_large_image"}]}),
  loader:({context})=>{
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/auth" });
    }
    return Promise.all([context.queryClient.ensureQueryData(qs[0]),context.queryClient.ensureQueryData(qs[1]),context.queryClient.ensureQueryData(qs[2]),context.queryClient.ensureQueryData(qs[3]),context.queryClient.ensureQueryData(qs[4]),context.queryClient.ensureQueryData(qs[5])]);
  },
  pendingComponent:ProfileSkeleton,
  component:Profile
});
function Profile(){
  if (typeof window !== "undefined" && !isAuthenticated()) {
    window.location.href = "/auth";
    return null;
  }
  const {data:m}=useSuspenseQuery(qs[0]);const {data:history}=useSuspenseQuery(qs[1]);const {data:battles}=useSuspenseQuery(qs[2]);const {data:pass}=useSuspenseQuery(qs[3]);const {data:proofs}=useSuspenseQuery(qs[4]);const {data:achievements}=useSuspenseQuery(qs[5]);
const initials = m.full_name
  ? m.full_name.split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
  : m.handle
  ? m.handle.slice(0, 2).toUpperCase()
  : "CC";
return <div className="page-wrap"><header className="profile-header"><div className="profile-mark">{initials}</div><div><p className="kicker">Competitive identity</p><h1>{m.full_name}</h1><p>@{m.handle} · {m.department} · {m.batch}</p><div><TierBadge>{m.tier}</TierBadge>{m.is_core_member&&<span className="proof-seal"><ShieldCheck/> CORE MEMBER</span>}</div></div><dl><div><dt>PRN</dt><dd>{m.prn}</dd></div><div><dt>Institutional mail</dt><dd>{m.email}</dd></div></dl></header><section className="metrics-grid"><Metric label="Rating" value={m.rating} detail={`Peak ${m.peak_rating}`}/><Metric label="University rank" value={`#${m.university_rank}`} detail={`of ${m.active_members}`}/><Metric label="Podiums" value={m.podiums} detail="Verified finishes"/><Metric label="Attendance" value={`${m.attendance_count}/${m.attendance_total}`} detail="Offline contests"/></section><section className="content-grid"><div className="panel wide"><SectionHeader kicker="Rating archive" title="Competitive trajectory"/><RatingChart data={history}/></div><div><CampusPassCard pass={pass}/></div></section><section className="panel"><SectionHeader kicker="Permanent record" title="Offline battle history"/><div className="battle-history">{battles.length===0?<div className="text-center py-8 text-[#777] font-mono text-xs">No offline battles recorded yet. Attend an offline contest to establish a permanent record.</div>:battles.map(b=><article key={b.certificate_id}><time>{new Date(b.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</time><div><h3>{b.contest}</h3><code>{b.certificate_id}</code></div><span>RANK <strong>#{b.rank}</strong></span><span>SOLVED <strong>{b.solved}</strong></span><span>PENALTY <strong>{b.penalty}</strong></span><em className={b.delta>=0?"positive":"negative"}>{b.delta>0?"+":""}{b.delta}</em></article>)}</div></section><section className="content-grid"><div className="panel"><SectionHeader kicker="Milestones" title="Achievement ledger"/><div className="achievement-grid">{achievements.length===0?<div className="text-center py-8 text-[#777] font-mono text-xs col-span-2">No achievements unlocked yet.</div>:achievements.map(a=><article key={a.code} className={a.earned?"earned":"locked"}>{a.earned?<Award/>:<LockKeyhole/>}<span>{a.code}</span><h3>{a.name}</h3><p>{a.description}</p></article>)}</div></div><div><SectionHeader kicker="Cryptographic result" title="Latest proof"/>{proofs[0]&&<ProofBadge proof={proofs[0]}/>}<Link className="text-link proof-link" to="/portal/verify" search={{proof:proofs[0]?.certificate_id??""}}>Open verification console <ExternalLink/></Link></div></section><footer className="trust-footer"><Zap/><p>Your profile only reflects attended, proctored sessions. Practice streaks and browser activity are intentionally excluded.</p></footer></div>}
