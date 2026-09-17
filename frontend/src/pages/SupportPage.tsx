import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, UserRoundCog } from "lucide-react";
import { api, errorMessage, unwrap } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, ErrorState, PageHeader, Section } from "../components/ui";

interface Ticket { _id:string; subject:string; description:string; status:string; priority:string; createdAt:string; }

export default function SupportPage(){
 const {isPlatformAdmin}=useAuth(); const qc=useQueryClient(); const [subject,setSubject]=useState(""); const [description,setDescription]=useState(""); const [targetUserId,setTargetUserId]=useState(""); const [reason,setReason]=useState("Support investigation"); const [impersonation,setImpersonation]=useState<{sessionId:string;accessToken:string;expiresAt:string}|null>(null);
 const q=useQuery({queryKey:["support-tickets"],queryFn:async()=>unwrap<Ticket[]>(await api.get("/infrastructure/support/tickets"))});
 const create=useMutation({mutationFn:async()=>unwrap(await api.post("/infrastructure/support/tickets",{subject,description,priority:"NORMAL"})),onSuccess:()=>{setSubject("");setDescription("");qc.invalidateQueries({queryKey:["support-tickets"]})}});
 const start=useMutation({mutationFn:async()=>unwrap<{sessionId:string;accessToken:string;expiresAt:string}>(await api.post("/infrastructure/support/impersonate",{targetUserId,reason})),onSuccess:setImpersonation});
 if(q.isError)return <ErrorState text={errorMessage(q.error,"Unable to load support tickets.")}/>;
 return <div className="space-y-6"><PageHeader eyebrow="Support" title="Support" description={isPlatformAdmin?"Review tenant support requests and use audited support impersonation when necessary.":"Create and track a support request."}/>
 {!isPlatformAdmin&&<Card><Section title="Create support ticket"><div className="space-y-4"><input className="field" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject"/><textarea className="field min-h-32" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the issue"/><Button onClick={()=>create.mutate()} loading={create.isPending} disabled={!subject.trim()||!description.trim()}><LifeBuoy size={15}/> Submit ticket</Button></div></Section></Card>}
 {isPlatformAdmin&&<Card><Section title="Audited impersonation" description="Use only for a documented support reason. The session expires after 30 minutes and is written to the audit log."><div className="grid gap-4 md:grid-cols-2"><label><span className="label">Target user ID</span><input className="field" value={targetUserId} onChange={e=>setTargetUserId(e.target.value)} placeholder="MongoDB user id"/></label><label><span className="label">Reason</span><input className="field" value={reason} onChange={e=>setReason(e.target.value)} /></label></div><div className="mt-4"><Button onClick={()=>start.mutate()} loading={start.isPending} disabled={!targetUserId.trim()}><UserRoundCog size={15}/> Start impersonation</Button></div>{impersonation&&<div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">Session <code>{impersonation.sessionId}</code> created until {new Date(impersonation.expiresAt).toLocaleString()}. Use the returned access token only in the controlled support workflow.</div>}</Section></Card>}
 <Section title="Tickets"><div className="space-y-3">{(q.data||[]).map(t=><Card key={t._id} padding="sm"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold text-white">{t.subject}</p><p className="mt-1 text-sm text-slate-500">{t.description}</p><p className="mt-2 text-xs text-slate-600">{new Date(t.createdAt).toLocaleString()}</p></div><Badge tone={t.status==="RESOLVED"?"green":"amber"}>{t.status}</Badge></div></Card>)}{!(q.data||[]).length&&<p className="text-sm text-slate-600">No support tickets.</p>}</div></Section></div>
}
