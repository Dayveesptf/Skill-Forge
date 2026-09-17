import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { api, errorMessage, unwrap } from "../../api";
import { Button, Card, ErrorState, Loading, PageHeader, Section, SuccessMessage } from "../../components/ui";

interface Organization {
  departments?: string[];
  teams?: Array<{ name: string; department?: string }>;
}

interface Team {
  name: string;
  department: string;
}

export default function OrganizationStructurePage() {
  const queryClient = useQueryClient();
  const [departments, setDepartments] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["organization", "structure"],
    queryFn: async () => unwrap<Organization>(await api.get("/organizations/me"))
  });

  useEffect(() => {
    if (!query.data) return;
    setDepartments(query.data.departments ?? []);
    setTeams((query.data.teams ?? []).map((team) => ({ name: team.name, department: team.department ?? "" })));
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: async () =>
      unwrap<Organization>(await api.patch("/organizations/me", { departments, teams })),
    onSuccess: () => {
      setMessage("Organization structure saved successfully.");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
    onError: (err) => {
      setMessage("");
      setError(errorMessage(err, "Unable to save organization structure."));
    }
  });

  if (query.isLoading) return <Loading label="Loading organization structure..." />;
  if (query.isError) return <ErrorState text={errorMessage(query.error, "Could not load organization structure.")} onRetry={() => query.refetch()} />;

  function addDepartment() {
    const value = newDepartment.trim();
    if (!value) return;
    if (!departments.some((item) => item.toLowerCase() === value.toLowerCase())) setDepartments((items) => [...items, value]);
    setNewDepartment("");
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Organization Administration"
        title="Organization structure"
        description="Define departments and teams used by role profiles, assessment campaigns and manager relationships. Manager assignments remain managed from Users."
        actions={<Button variant="secondary" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw size={15} /> Refresh</Button>}
      />

      {message && <SuccessMessage text={message} />}
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <Section title="Departments" description="Create the departments used throughout your organization.">
            <div className="flex gap-2">
              <input className="field" value={newDepartment} onChange={(event) => setNewDepartment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDepartment(); } }} placeholder="e.g. Engineering" />
              <Button type="button" onClick={addDepartment}><Plus size={15} /> Add</Button>
            </div>
            <div className="mt-5 space-y-2">
              {departments.length === 0 ? <p className="text-sm text-slate-600">No departments defined yet.</p> : departments.map((department) => (
                <div key={department} className="flex items-center justify-between rounded-xl border border-line bg-ink px-4 py-3">
                  <span className="text-sm font-medium text-white">{department}</span>
                  <button type="button" className="text-slate-600 hover:text-red-300" onClick={() => setDepartments((items) => items.filter((item) => item !== department))} aria-label={`Remove ${department}`}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </Section>
        </Card>

        <Card>
          <Section title="Teams" description="Create teams and optionally associate each team with a department.">
            <div className="space-y-3">
              {teams.map((team, index) => (
                <div key={`${team.name}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input className="field" value={team.name} onChange={(event) => setTeams((items) => items.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} placeholder="Team name" />
                  <select className="field" value={team.department} onChange={(event) => setTeams((items) => items.map((item, i) => i === index ? { ...item, department: event.target.value } : item))}>
                    <option value="">No department</option>
                    {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                  </select>
                  <Button variant="ghost" type="button" onClick={() => setTeams((items) => items.filter((_, i) => i !== index))}><Trash2 size={15} /></Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => setTeams((items) => [...items, { name: "", department: "" }])}><Plus size={15} /> Add team</Button>
            </div>
          </Section>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-300"><Building2 size={18} /></div>
            <div><p className="font-semibold text-white">Save organization structure</p><p className="text-sm text-slate-600">These values are tenant-scoped.</p></div>
          </div>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}><Save size={15} /> Save structure</Button>
        </div>
      </Card>
    </div>
  );
}
