import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock3, MapPin, MonitorCog, ShieldCheck, Terminal, Trophy, Users } from "lucide-react";
import { ScoreboardMatrix } from "@/organization/components/ScoreboardMatrix";
import { Button } from "@/components/ui/button";
import { SectionHeader, StatusDot, formatContestDate } from "@/organization/components/ui";
import { portalQueries } from "@/organization/data/queries";
export const Route=createFileRoute("/portal/contests/$contestSlug")({loader:async({context,params})=>{const contest=await context.queryClient.ensureQueryData(portalQueries.contest(params.contestSlug));if(!contest)throw notFound();return contest},head:({loaderData})=>({meta:[{title:loaderData?`${loaderData.title} — CCC Medi-Caps`:"Contest unavailable"},{name:"description",content:loaderData?.summary??"Contest record unavailable."},{property:"og:title",content:loaderData?.title??"Contest unavailable"},{property:"og:description",content:loaderData?.summary??"Contest record unavailable."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}),notFoundComponent:()=> <div className="page-wrap"><h1>Contest record not found.</h1></div>,component:ContestDetail});
function ContestDetail(){const {contestSlug}=Route.useParams();const {data:c}=useSuspenseQuery(portalQueries.contest(contestSlug));if(!c)return null;return <div className="page-wrap"><Link to="/portal/contests" search={{status:"all"}} className="back-link"><ArrowLeft/> All contests</Link><header className="contest-hero"><div><StatusDot status={c.status}/><p className="kicker">{c.season} · {c.division.replace("_"," ")}</p><h1>{c.title}</h1><p>{c.summary}</p></div><dl><div><dt><Clock3/> Contest window</dt><dd>{formatContestDate(c.starts_at)}<br/>{formatContestDate(c.ends_at)}</dd></div><div><dt><MapPin/> Venue</dt><dd>{c.venue}</dd></div><div><dt><Users/> Capacity</dt><dd>{c.registered_count} / {c.seat_capacity} registered</dd></div><div><dt><MonitorCog/> Runtime</dt><dd>{c.environment}</dd></div></dl></header><div className="registration-band">
  <div>
    <strong>Phase 1 Online Screening Assessment Active</strong>
    <span>Appear in the online assessment round to qualify among the Top 30 for the in-person physical lab final.</span>
  </div>
  <div className="flex items-center gap-2 flex-wrap">
    <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-mono text-xs">
      <Link to="/portal/assessments/$contestSlug" params={{ contestSlug: c.slug }}>
        <Terminal size={14} className="mr-1.5" /> ASSESSMENT STUDIO
      </Link>
    </Button>
    <Button variant="outline" asChild className="font-mono text-xs border-[#333]">
      <Link to="/portal/assessments/$contestSlug/leaderboard" params={{ contestSlug: c.slug }}>
        <Trophy size={14} className="mr-1.5" /> LEADERBOARD
      </Link>
    </Button>
  </div>
</div><section className="panel"><SectionHeader kicker="Sealed set" title={`${c.problem_count} contest problems`}/><div className="problem-list">{c.problems.map(p=><article key={p.index}><span>{p.index}</span><div><h3>{p.title}</h3><p>{p.topic}</p></div><strong>{p.points}</strong><small>{c.status==="finished"?`${p.solved_count} solves`:"SEALED"}</small></article>)}</div></section>{c.standings.length>0&&<section className="panel standings-panel"><SectionHeader kicker="Verified scoreboard" title="Official standings"/><ScoreboardMatrix entries={c.standings} problems={c.problems}/></section>}<section className="contest-lower"><div className="panel"><SectionHeader kicker="Room protocol" title="Contest rules"/><ol className="rule-list">{c.rules.map((r,i)=><li key={r}><span>{String(i+1).padStart(2,"0")}</span>{r}</li>)}</ol></div><div className="panel"><SectionHeader kicker="Trust chain" title="Proctor authority"/><div className="proctor-list">{c.chief_proctors.map(x=><p key={x}><ShieldCheck/>{x}</p>)}</div><p className="micro-copy">Final scoreboards are signed only after submission, seat, attendance, and incident logs reconcile.</p></div></section></div>}
