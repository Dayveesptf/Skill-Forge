import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Save } from "lucide-react";
import { api, errorMessage, unwrap } from "../../api";
import { Button, Card, ErrorState, Loading, PageHeader, Section, SuccessMessage } from "../../components/ui";

interface Organization {
  frameworkVersionId?: string | { _id?: string };
  skillLibrary?: {
    mode?: "FULL" | "CURATED";
    skills?: Array<{ skillId: string | { _id?: string }; enabled: boolean; weight: number }>;
    behaviouralFactors?: Array<{ behaviouralFactorId: string | { _id?: string }; enabled: boolean; weight: number }>;
  };
}
interface Skill { _id: string; name: string; category: string; description?: string; }
interface Factor { _id: string; name: string; description?: string; }
interface Selection { id: string; enabled: boolean; weight: number; }
function refId(value: string | { _id?: string }) { return typeof value === "string" ? value : value._id ?? ""; }
function frameworkId(value?: Organization["frameworkVersionId"]) { return typeof value === "string" ? value : value?._id ?? ""; }

export default function OrganizationSkillLibraryPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"FULL" | "CURATED">("FULL");
  const [skills, setSkills] = useState<Selection[]>([]);
  const [factors, setFactors] = useState<Selection[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const orgQuery = useQuery({ queryKey: ["organization", "skill-library"], queryFn: async () => unwrap<Organization>(await api.get("/organizations/me")) });
  const frameworkIdValue = frameworkId(orgQuery.data?.frameworkVersionId);
  const skillsQuery = useQuery({ queryKey: ["framework-skills", frameworkIdValue], enabled: Boolean(frameworkIdValue), queryFn: async () => unwrap<Skill[]>(await api.get(`/frameworks/${frameworkIdValue}/skills`)) });
  const factorsQuery = useQuery({ queryKey: ["framework-factors", frameworkIdValue], enabled: Boolean(frameworkIdValue), queryFn: async () => unwrap<Factor[]>(await api.get(`/frameworks/${frameworkIdValue}/behavioural-factors`)) });

  useEffect(() => {
    if (!orgQuery.data) return;
    setMode(orgQuery.data.skillLibrary?.mode ?? "FULL");
    setSkills((orgQuery.data.skillLibrary?.skills ?? []).map((item) => ({ id: refId(item.skillId), enabled: item.enabled, weight: item.weight })));
    setFactors((orgQuery.data.skillLibrary?.behaviouralFactors ?? []).map((item) => ({ id: refId(item.behaviouralFactorId), enabled: item.enabled, weight: item.weight })));
  }, [orgQuery.data]);

  useEffect(() => {
    if (skillsQuery.data && skills.length === 0) setSkills(skillsQuery.data.map((item) => ({ id: item._id, enabled: true, weight: 1 })));
    if (factorsQuery.data && factors.length === 0) setFactors(factorsQuery.data.map((item) => ({ id: item._id, enabled: true, weight: 1 })));
  }, [skillsQuery.data, factorsQuery.data, skills.length, factors.length]);

  const saveMutation = useMutation({
    mutationFn: async () => unwrap(await api.patch("/organizations/me", { skillLibrary: { mode, skills: skills.filter((item) => item.id), behaviouralFactors: factors.filter((item) => item.id) } })),
    onSuccess: () => { setMessage("Skill library configuration saved successfully."); setError(""); queryClient.invalidateQueries({ queryKey: ["organization"] }); },
    onError: (err) => { setMessage(""); setError(errorMessage(err, "Unable to save skill library configuration.")); }
  });

  const skillMap = useMemo(() => new Map((skillsQuery.data ?? []).map((item) => [item._id, item])), [skillsQuery.data]);
  const factorMap = useMemo(() => new Map((factorsQuery.data ?? []).map((item) => [item._id, item])), [factorsQuery.data]);

  if (orgQuery.isLoading || skillsQuery.isLoading || factorsQuery.isLoading) return <Loading label="Loading skill library..." />;
  if (orgQuery.isError || skillsQuery.isError || factorsQuery.isError) return <ErrorState text={errorMessage(orgQuery.error || skillsQuery.error || factorsQuery.error, "Could not load the skill library.")} onRetry={() => { orgQuery.refetch(); skillsQuery.refetch(); factorsQuery.refetch(); }} />;

  if (!frameworkIdValue) return <Card><p className="text-sm text-slate-400">No framework version has been adopted for this organization yet. Adopt a framework version first.</p></Card>;

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Organization Administration" title="Skill library" description="Choose the full framework library or curate the competencies your organization uses for role profiles and assessments." actions={<Button variant="secondary" onClick={() => { orgQuery.refetch(); skillsQuery.refetch(); factorsQuery.refetch(); }}><RefreshCw size={15} /> Refresh</Button>} />
      {message && <SuccessMessage text={message} />}
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>}
      <Card><Section title="Library mode" description="Full keeps every active framework competency available. Curated lets the organization switch specific competencies off."><div className="grid gap-3 md:grid-cols-2">{(["FULL", "CURATED"] as const).map((value) => <button type="button" key={value} onClick={() => setMode(value)} className={`rounded-xl border p-4 text-left ${mode === value ? "border-brand-400 bg-brand-500/10" : "border-line bg-ink"}`}><p className="font-semibold text-white">{value === "FULL" ? "Full framework library" : "Curated organization subset"}</p><p className="mt-1 text-xs leading-5 text-slate-500">{value === "FULL" ? "All active skills and behavioural factors remain available." : "Disable competencies that are not relevant to this organization."}</p></button>)}</div></Section></Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><Section title="Technical & functional skills" description="Enable competencies and adjust their organization-level weighting."><div className="space-y-2">{skills.map((selection) => { const skill = skillMap.get(selection.id); if (!skill) return null; return <div key={selection.id} className="grid gap-3 rounded-xl border border-line bg-ink p-3 sm:grid-cols-[auto_1fr_90px] sm:items-center"><input type="checkbox" checked={selection.enabled} onChange={(event) => setSkills((items) => items.map((item) => item.id === selection.id ? { ...item, enabled: event.target.checked } : item))} /><div><p className="text-sm font-medium text-white">{skill.name}</p><p className="text-xs text-slate-600">{skill.category}</p></div><input className="field" type="number" min={0} max={100} step={0.1} value={selection.weight} onChange={(event) => setSkills((items) => items.map((item) => item.id === selection.id ? { ...item, weight: Number(event.target.value) } : item))} aria-label={`${skill.name} weight`} /></div>})}</div></Section></Card>
        <Card><Section title="Behavioural factors" description="Enable behavioural factors and adjust their weighting."><div className="space-y-2">{factors.map((selection) => { const factor = factorMap.get(selection.id); if (!factor) return null; return <div key={selection.id} className="grid gap-3 rounded-xl border border-line bg-ink p-3 sm:grid-cols-[auto_1fr_90px] sm:items-center"><input type="checkbox" checked={selection.enabled} onChange={(event) => setFactors((items) => items.map((item) => item.id === selection.id ? { ...item, enabled: event.target.checked } : item))} /><div><p className="text-sm font-medium text-white">{factor.name}</p><p className="text-xs text-slate-600">Behavioural factor</p></div><input className="field" type="number" min={0} max={100} step={0.1} value={selection.weight} onChange={(event) => setFactors((items) => items.map((item) => item.id === selection.id ? { ...item, weight: Number(event.target.value) } : item))} aria-label={`${factor.name} weight`} /></div>})}</div></Section></Card>
      </div>
      <div className="flex justify-end"><Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}><Save size={15} /> Save library configuration</Button></div>
    </div>
  );
}
