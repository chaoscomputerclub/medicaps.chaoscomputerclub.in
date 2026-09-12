import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function SectionHeader({kicker,title,action}:{kicker:string;title:string;action?:ReactNode}){return <div className="section-heading"><div><p className="kicker">{kicker}</p><h2>{title}</h2></div>{action}</div>}
export function StatusDot({status}:{status:"live"|"upcoming"|"finished"}){return <span className={cn("status-label",status)}><i />{status}</span>}
export function Metric({label,value,detail}:{label:string;value:string|number;detail?:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>}
export function TierBadge({children}:{children:ReactNode}){return <span className="tier-badge">{children}</span>}
export function MonoTag({children,className}:{children:ReactNode;className?:string}){return <span className={cn("mono-tag",className)}>{children}</span>}
export function EmptyState({title,body}:{title:string;body:string}){return <div className="empty-state"><span>∅</span><h3>{title}</h3><p>{body}</p></div>}
export function formatPenalty(seconds:number){const h=Math.floor(seconds/3600);const m=Math.floor((seconds%3600)/60);const s=seconds%60;return [h,m,s].map(v=>String(v).padStart(2,"0")).join(":")}
export function formatContestDate(value:string){return new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(new Date(value))+" IST"}
