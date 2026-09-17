import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, KeyRound } from "lucide-react";
import { api, errorMessage, unwrap } from "./../api";
import { Badge, Button, Card, ErrorState, PageHeader, Section, SuccessMessage } from "../components/ui";

interface MfaStatus { enabled: boolean }
interface Setup { secret: string; otpauthUrl: string }

export default function SecuritySettingsPage() {
  const qc = useQueryClient(); const [setup, setSetup] = useState<Setup | null>(null); const [code, setCode] = useState(""); const [backupCodes, setBackupCodes] = useState<string[]>([]); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const status = useQuery({ queryKey: ["mfa-status"], queryFn: async () => unwrap<MfaStatus>(await api.get("/infrastructure/mfa/status")) });
  const start = useMutation({ mutationFn: async () => unwrap<Setup>(await api.post("/infrastructure/mfa/setup")), onSuccess: x => { setSetup(x); setError(""); } });
  const enable = useMutation({ mutationFn: async () => unwrap<{ backupCodes: string[] }>(await api.post("/infrastructure/mfa/enable", { code })), onSuccess: x => { setBackupCodes(x.backupCodes); setSetup(null); setCode(""); setMessage("Two-factor authentication is now enabled."); qc.invalidateQueries({ queryKey: ["mfa-status"] }); }, onError: e => setError(errorMessage(e, "Unable to enable MFA.")) });
  const disable = useMutation({ mutationFn: async () => unwrap(await api.post("/infrastructure/mfa/disable")), onSuccess: () => { setMessage("Two-factor authentication has been disabled."); qc.invalidateQueries({ queryKey: ["mfa-status"] }); } });
  if (status.isLoading) return <div className="p-8 text-slate-500">Loading security settings...</div>;
  if (status.isError) return <ErrorState text={errorMessage(status.error, "Unable to load security settings.")} />;
  return <div className="space-y-6"><PageHeader eyebrow="Account security" title="Security" description="Protect your SkillForge account with multi-factor authentication." />
    {message && <SuccessMessage text={message} />}{error && <ErrorState text={error} />}
    <Card><Section title="Two-factor authentication" description="Use a time-based one-time password from an authenticator app when signing in."><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-300"><ShieldCheck size={20}/></div><div><p className="font-semibold text-white">MFA protection</p><div className="mt-1"><Badge tone={status.data?.enabled ? "green" : "slate"}>{status.data?.enabled ? "Enabled" : "Disabled"}</Badge></div></div></div>{status.data?.enabled ? <Button variant="danger" onClick={() => disable.mutate()} loading={disable.isPending}><ShieldOff size={15}/> Disable</Button> : <Button onClick={() => start.mutate()} loading={start.isPending}><KeyRound size={15}/> Set up MFA</Button>}</div>
      {setup && <div className="mt-6 rounded-xl border border-line bg-ink p-5"><p className="font-semibold text-white">Add this account to your authenticator</p><p className="mt-2 text-sm text-slate-500">Use the secret below if your authenticator cannot scan a QR code.</p><code className="mt-4 block break-all rounded-lg bg-black/30 p-3 text-sm text-brand-300">{setup.secret}</code><p className="mt-4 text-xs text-slate-600">Then enter the 6-digit code shown by your authenticator.</p><div className="mt-3 flex gap-2"><input className="field max-w-xs" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456"/><Button onClick={() => enable.mutate()} disabled={code.length !== 6} loading={enable.isPending}>Verify & enable</Button></div></div>}
      {backupCodes.length > 0 && <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5"><p className="font-semibold text-amber-200">Save your backup codes</p><p className="mt-1 text-sm text-slate-500">Each code can be used once if you lose access to your authenticator.</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{backupCodes.map(x => <code key={x} className="rounded-lg bg-ink px-3 py-2 text-center text-xs text-slate-300">{x}</code>)}</div></div>}
    </Section></Card></div>;
}
