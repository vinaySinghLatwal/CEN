import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  societyService,
  userService,
  skillService,
  resourceService,
  eventService,
  complaintService,
  noticeService,
  creditService,
} from "@/services";
import {
  Building2, Users, ClipboardList, Wallet, CheckSquare, AlertCircle,
  Calendar, Megaphone, Sparkles, Package, ArrowUpRight, ArrowDownLeft,
  Settings, ShieldAlert, Award, ChevronRight, Activity, Plus
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getCoordinatorEventSuggestions, getResidentSuggestions } from "@/services/ai";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

function Stat({ 
  icon: Icon, 
  label, 
  value, 
  hint, 
  trend 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  label: string; 
  value: React.ReactNode; 
  hint?: string;
  trend?: { value: string; type: "up" | "down" | "neutral" }
}) {
  return (
    <Card className="border-line/60 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-deep-forest/10 text-deep-forest transition-all group-hover:scale-105 duration-300">
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">{label}</div>
          <div className="text-2xl font-bold text-ink mt-0.5">{value}</div>
          {hint && <div className="text-[10px] text-on-surface-variant/85 mt-1 truncate">{hint}</div>}
        </div>
        {trend && (
          <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
            trend.type === "up" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
              : trend.type === "down"
              ? "bg-red-50 text-red-800 border-red-100"
              : "bg-slate-50 text-slate-800 border-slate-100"
          }`}>
            {trend.value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { user, effectiveRole } = useAuth();
  const sid = user?.societyId;
  const isNotOwner = effectiveRole !== "owner";

  const soc = useQuery({
    queryKey: ["soc", sid],
    queryFn: () => societyService.getById(sid!),
    enabled: !!sid && isNotOwner,
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Role specific premium greetings banner */}
      <div className="bg-gradient-to-r from-deep-forest/5 via-soft-violet/5 to-transparent border border-line/50 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-headline-lg text-2xl font-bold text-ink leading-tight">
            Welcome back, {user!.name.split(" ")[0]}
          </h1>
          <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed flex flex-wrap items-center gap-1.5">
            You're currently connected as a <span className="font-semibold text-deep-forest capitalize">{effectiveRole === "owner" ? "System Manager" : effectiveRole}</span>
            {isNotOwner && soc.data && (
              <>
                <span>on</span>
                <span className="inline-flex items-center gap-1 bg-deep-forest/5 text-deep-forest border border-deep-forest/15 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  <Building2 className="h-3 w-3" /> {soc.data.name}
                </span>
              </>
            )}
            .
          </p>
        </div>
        <Badge className="bg-deep-forest hover:bg-deep-forest/90 text-white border-0 py-1 px-3 text-[10px] font-bold uppercase tracking-wider">
          {effectiveRole === "owner" ? "System Manager" : `${effectiveRole} console`}
        </Badge>
      </div>

      {effectiveRole === "owner" && <OwnerDash />}
      {effectiveRole === "admin" && <AdminDash />}
      {effectiveRole === "coordinator" && <CoordDash />}
      {effectiveRole === "resident" && <ResidentDash />}
    </div>
  );
}

function OwnerDash() {
  const societies = useQuery({ queryKey: ["societies"], queryFn: () => societyService.list() });
  const apps = useQuery({ queryKey: ["apps"], queryFn: () => societyService.listApplications() });
  const pending = apps.data?.filter((a) => a.status === "pending").length ?? 0;
  const total = societies.data?.length ?? 0;
  
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={Building2} label="Active Societies" value={total} trend={{ value: "+2 new", type: "up" }} />
        <Stat icon={Users} label="Total Residents" value="3,240" hint="Across all societies" trend={{ value: "+12.5%", type: "up" }} />
        <Stat icon={ClipboardList} label="Pending Applications" value={pending} hint="Requires your response" trend={{ value: pending > 0 ? "Action required" : "Clear", type: pending > 0 ? "down" : "neutral" }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Applications card */}
        <Card className="lg:col-span-2 border-line/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-ink">Recent Applications</CardTitle>
            <CardDescription className="text-xs text-on-surface-variant">Review new society requests waiting for setup clearance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {apps.data?.filter((a) => a.status === "pending").length === 0 ? (
              <div className="py-6 text-center text-xs text-on-surface-variant border border-dashed border-line rounded-lg">
                No pending applications. Platform is up to date!
              </div>
            ) : (
              apps.data?.filter((a) => a.status === "pending").slice(0, 3).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-line/50 p-4 hover:bg-panel transition-all">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-ink truncate">{a.societyName}</div>
                    <div className="text-xs text-on-surface-variant mt-0.5 truncate">{a.type} · Requested by {a.applicantName}</div>
                  </div>
                  <Link to="/app/owner/applications">
                    <button className="flex items-center gap-1 bg-white hover:bg-surface-variant border border-line-strong text-ink text-[11px] font-semibold py-1 px-3 rounded-lg transition-all active:scale-95 cursor-pointer">
                      Review <ChevronRight className="h-3 w-3" />
                    </button>
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Owner Quick Actions */}
        <Card className="border-line/60 shadow-sm flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base font-bold text-ink font-headline-lg">Management Panel</CardTitle>
            <CardDescription className="text-xs text-on-surface-variant">Access system configuration modules directly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Link to="/app/owner/societies" className="block">
              <button className="w-full flex items-center justify-between border border-line/50 hover:bg-panel p-3 rounded-xl transition-all text-left cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-deep-forest">domain</span>
                  <span className="text-xs font-bold text-ink">Manage Societies</span>
                </div>
                <ChevronRight className="h-4 w-4 text-on-surface-variant" />
              </button>
            </Link>

            <Link to="/app/owner/applications" className="block">
              <button className="w-full flex items-center justify-between border border-line/50 hover:bg-panel p-3 rounded-xl transition-all text-left cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-soft-violet">pending_actions</span>
                  <span className="text-xs font-bold text-ink">Pending Applications</span>
                </div>
                <ChevronRight className="h-4 w-4 text-on-surface-variant" />
              </button>
            </Link>

            <Link to="/app/owner/analytics" className="block">
              <button className="w-full flex items-center justify-between border border-line/50 hover:bg-panel p-3 rounded-xl transition-all text-left cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-indigo-500">monitoring</span>
                  <span className="text-xs font-bold text-ink">System Analytics</span>
                </div>
                <ChevronRight className="h-4 w-4 text-on-surface-variant" />
              </button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminDash() {
  const { user } = useAuth();
  const sid = user!.societyId!;
  const soc = useQuery({ queryKey: ["soc", sid], queryFn: () => societyService.getById(sid) });
  const residents = useQuery({ queryKey: ["residents", sid], queryFn: () => userService.listBySociety(sid) });
  const coords = useQuery({ queryKey: ["coords", sid], queryFn: () => userService.listCoordinators(sid) });
  const s = soc.data;
  const coordCount = coords.data?.length ?? 0;
  
  const actualResidentCount = residents.data?.filter((u) => u.role !== "admin" && u.role !== "owner").length ?? 0;
  
  return (
    <div className="space-y-6">
      {coordCount < 2 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm border-l-4 border-l-amber-600">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-bold text-xs text-amber-950 dark:text-amber-200">Society Setup Incomplete</div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-normal mt-1">
                You have appointed {coordCount} out of 2 minimum required coordinators. Residents cannot complete exchanges until the second coordinator is appointed.
              </p>
              <Link to="/app/admin/coordinators" className="inline-block mt-2">
                <button className="bg-amber-700 hover:bg-amber-800 text-white text-[10px] font-bold py-1 px-3 rounded transition-all cursor-pointer">
                  Appoint Coordinators
                </button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={Users} label="Total Residents" value={`${actualResidentCount} / ${s?.capacity ?? "—"}`} trend={{ value: "Capacity status", type: "neutral" }} />
        <Stat icon={CheckSquare} label="Coordinators" value={`${coordCount}/2`} hint="Minimum requirement" trend={{ value: coordCount >= 2 ? "Ready" : "Incomplete", type: coordCount >= 2 ? "up" : "down" }} />
        <Stat icon={Sparkles} label="Performance" value={`${s?.performanceScore ?? "—"}/100`} hint="Society health index" trend={{ value: "+2.5% MoM", type: "up" }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Admin overview info */}
        <Card className="lg:col-span-2 border-line/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-ink">Society Configurator</CardTitle>
            <CardDescription className="text-xs text-on-surface-variant">Update active guidelines, society structure, and resident policies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-line/50 bg-panel">
                <div className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Society Key</div>
                <code className="text-xs font-mono font-bold block mt-1.5 p-1 px-2 border border-line bg-white rounded truncate select-all">{s?.key ?? "Generating..."}</code>
                <span className="text-[9px] text-on-surface-variant/80 mt-1 block">Used by residents to join.</span>
              </div>
              <div className="p-4 rounded-xl border border-line/50 bg-panel">
                <div className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Ecosystem Type</div>
                <div className="text-xs font-bold text-ink mt-1.5 capitalize">{s?.type ?? "Standard Community"}</div>
                <span className="text-[9px] text-on-surface-variant/80 mt-1.5 block">Credit exchange enabled.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Quick Console links */}
        <Card className="border-line/60 shadow-sm flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base font-bold text-ink">Management Console</CardTitle>
            <CardDescription className="text-xs text-on-surface-variant">Quick links to audit tables.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Link to="/app/admin/coordinators" className="block">
              <button className="w-full flex items-center justify-between border border-line/50 hover:bg-panel p-3 rounded-xl transition-all text-left cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-deep-forest">admin_panel_settings</span>
                  <span className="text-xs font-bold text-ink">Coordinators Panel</span>
                </div>
                <ChevronRight className="h-4 w-4 text-on-surface-variant" />
              </button>
            </Link>

            <Link to="/app/admin/residents" className="block">
              <button className="w-full flex items-center justify-between border border-line/50 hover:bg-panel p-3 rounded-xl transition-all text-left cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-soft-violet">people_outline</span>
                  <span className="text-xs font-bold text-ink">Residents Audit</span>
                </div>
                <ChevronRight className="h-4 w-4 text-on-surface-variant" />
              </button>
            </Link>

            <Link to="/app/admin/performance" className="block">
              <button className="w-full flex items-center justify-between border border-line/50 hover:bg-panel p-3 rounded-xl transition-all text-left cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-indigo-500">monitoring</span>
                  <span className="text-xs font-bold text-ink">Performance Dashboard</span>
                </div>
                <ChevronRight className="h-4 w-4 text-on-surface-variant" />
              </button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CoordDash() {
  const { user } = useAuth();
  const sid = user!.societyId!;
  const pendSkills = useQuery({ queryKey: ["pSkills", sid], queryFn: () => skillService.listPending(sid) });
  const pendRes = useQuery({ queryKey: ["pRes", sid], queryFn: () => resourceService.listPending(sid) });
  const complaints = useQuery({ queryKey: ["comps", sid], queryFn: () => complaintService.listSociety(sid) });
  const events = useQuery({ queryKey: ["ev", sid], queryFn: () => eventService.list(sid) });
  const coordSuggestions = useQuery({ queryKey: ["coordSugg", sid], queryFn: () => getCoordinatorEventSuggestions() });
  
  const openComps = complaints.data?.filter((c) => c.status === "open").length ?? 0;
  const approvalCount = (pendSkills.data?.filter((s) => s.providerId !== user!.id).length ?? 0) +
                        (pendRes.data?.filter((r) => r.ownerId !== user!.id).length ?? 0);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Main Column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Approvals Action Board */}
        <Card className="border-line/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-ink">Coordinator Action Board</CardTitle>
            <CardDescription className="text-xs text-on-surface-variant">Clear list approvals and resolve member disputes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Link to="/app/coord/approvals" className="block">
              <div className="p-4 rounded-xl border border-line/50 bg-panel flex justify-between items-center hover:bg-panel/80 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-ink">Skill & Resource Listings</div>
                    <div className="text-[10px] text-on-surface-variant mt-0.5">{approvalCount} listings awaiting approval.</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-on-surface-variant" />
              </div>
            </Link>

            <Link to="/app/coord/disputes" className="block">
              <div className="p-4 rounded-xl border border-line/50 bg-panel flex justify-between items-center hover:bg-panel/80 transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800">
                    <span className="material-symbols-outlined text-[18px]">gavel</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-ink">Active Mediation Issues</div>
                    <div className="text-[10px] text-on-surface-variant mt-0.5">Moderate disputing exchanges.</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-on-surface-variant" />
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* AI Event Strategy Widget */}
        <Card className="border-emerald-200 shadow-sm bg-gradient-to-br from-emerald-50 via-white to-transparent">
          <CardHeader className="pb-3 border-b border-emerald-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 border border-emerald-200">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-ink">AI Event Strategy</CardTitle>
                <CardDescription className="text-xs text-on-surface-variant">Data-driven event ideas based on resident onboarding preferences.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {coordSuggestions.isLoading ? (
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-3 py-1">
                  <div className="h-4 bg-emerald-200/50 rounded w-3/4"></div>
                  <div className="h-4 bg-emerald-200/50 rounded"></div>
                  <div className="h-4 bg-emerald-200/50 rounded w-5/6"></div>
                </div>
              </div>
            ) : coordSuggestions.data && coordSuggestions.data.length > 0 ? (
              coordSuggestions.data.map((s, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-emerald-100 bg-white/60">
                  <div className="text-sm font-bold text-emerald-950">{s.title}</div>
                  <div className="text-xs text-emerald-800/80 mt-0.5">{s.description}</div>
                  <div className="text-[10px] mt-1.5 font-medium text-emerald-700">💡 Why? {s.reason}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-emerald-800">No suggestions available right now.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Side Column */}
      <div className="lg:col-span-1 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat icon={CheckSquare} label="Pending Approvals" value={approvalCount} trend={{ value: approvalCount > 0 ? "Action needed" : "Clear", type: approvalCount > 0 ? "down" : "neutral" }} />
          <Stat icon={AlertCircle} label="Open Complaints" value={openComps} trend={{ value: openComps > 0 ? "Pending" : "Resolved", type: openComps > 0 ? "down" : "neutral" }} />
          <Stat icon={Calendar} label="Upcoming Events" value={events.data?.filter((e) => e.status === "upcoming").length ?? 0} />
          <Stat icon={Wallet} label="My Wallet Balance" value={`${user!.creditBalance} Crd`} />
        </div>

        {/* Quick Links Menu */}
        <Card className="border-line/60 shadow-sm flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base font-bold text-ink">Coordinator Tools</CardTitle>
            <CardDescription className="text-xs text-on-surface-variant">Active society controls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Link to="/app/coord/events" className="block">
              <button className="w-full flex items-center justify-between border border-line/50 hover:bg-panel p-3 rounded-xl transition-all text-left cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-deep-forest">event_note</span>
                  <span className="text-xs font-bold text-ink">Events Manager</span>
                </div>
                <ChevronRight className="h-4 w-4 text-on-surface-variant" />
              </button>
            </Link>

            <Link to="/app/coord/complaints" className="block">
              <button className="w-full flex items-center justify-between border border-line/50 hover:bg-panel p-3 rounded-xl transition-all text-left cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-rose-500">campaign</span>
                  <span className="text-xs font-bold text-ink">Member Reports</span>
                </div>
                <ChevronRight className="h-4 w-4 text-on-surface-variant" />
              </button>
            </Link>

            <Link to="/app/notices" className="block">
              <button className="w-full flex items-center justify-between border border-line/50 hover:bg-panel p-3 rounded-xl transition-all text-left cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-indigo-500">newsmode</span>
                  <span className="text-xs font-bold text-ink">Notice Board</span>
                </div>
                <ChevronRight className="h-4 w-4 text-on-surface-variant" />
              </button>
            </Link>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

function ResidentDash() {
  const { user } = useAuth();
  const sid = user!.societyId!;
  const skills = useQuery({ queryKey: ["mySkills", sid], queryFn: () => skillService.list(sid) });
  const complaints = useQuery({ queryKey: ["myComps", user!.id], queryFn: () => complaintService.listForUser(user!.id) });
  const notices = useQuery({ queryKey: ["notices", sid], queryFn: () => noticeService.list(sid) });
  const txs = useQuery({ queryKey: ["tx", user!.id], queryFn: () => creditService.getTransactions(user!.id) });
  const residentSuggestions = useQuery({ queryKey: ["resSugg", user!.id], queryFn: () => getResidentSuggestions() });
  const userSummary = useQuery({ queryKey: ["userSummary", user!.id], queryFn: () => userService.getSummary() });

  const myOpen = complaints.data?.filter((c) => c.status === "open").length ?? 0;
  const myActive = skills.data?.filter((s) => s.providerId === user!.id && s.status === "approved").length ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Column */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Personalized AI Summary Widget */}
        <Card className="border-emerald-200 shadow-sm bg-gradient-to-br from-emerald-50 via-white to-transparent">
          <CardHeader className="pb-3 border-b border-emerald-100">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 border border-emerald-200">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-ink">Your Community Pulse (AI Summary)</CardTitle>
                </div>
              </div>
              {userSummary.data?.generated_at && (
                <span className="text-[10px] text-on-surface-variant font-medium">
                  Updated {new Date(userSummary.data.generated_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-xs text-ink leading-relaxed font-medium">
              {userSummary.isLoading ? "Loading your latest community pulse..." : userSummary.data?.summary}
            </p>
          </CardContent>
        </Card>

        {/* Recommended for You Widget (AI) */}
        <Card className="border-soft-violet/30 shadow-sm bg-gradient-to-br from-soft-violet/5 via-[#fbfaff] to-transparent">
          <CardHeader className="pb-3 border-b border-soft-violet/15">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-soft-violet/15 flex items-center justify-center text-soft-violet border border-soft-violet/20">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-ink">AI Skill Recommendations</CardTitle>
                  <CardDescription className="text-[10px] text-on-surface-variant">Tailored service suggestions matching your listed interests.</CardDescription>
                </div>
              </div>
              <Link to="/app/skills">
                <span className="text-[10px] font-bold text-soft-violet hover:underline cursor-pointer">Browse All</span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {residentSuggestions.isLoading ? (
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-3 py-1">
                  <div className="h-4 bg-soft-violet/20 rounded w-3/4"></div>
                  <div className="h-4 bg-soft-violet/20 rounded"></div>
                </div>
              </div>
            ) : residentSuggestions.data?.skillSuggestions?.length === 0 ? (
              <div className="py-6 text-center text-xs text-on-surface-variant border border-dashed border-line rounded-xl bg-white">
                No matching listings found. Try updating your interests in Settings!
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {residentSuggestions.data?.skillSuggestions.map((s: any) => (
                  <div key={s.id} className="bg-white border border-line/45 hover:border-soft-violet/40 p-3.5 rounded-xl flex flex-col justify-between hover:shadow-sm transition-all group">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Badge className="bg-soft-violet/10 text-soft-violet hover:bg-soft-violet/15 text-[8px] uppercase tracking-wide border-0 font-bold px-1.5 py-0.5 rounded">
                          {s.category}
                        </Badge>
                        <span className="text-[10px] font-bold text-deep-forest">{s.credits} Crd</span>
                      </div>
                      <div className="font-bold text-xs text-ink truncate group-hover:text-soft-violet transition-colors">{s.title}</div>
                      <p className="text-[9px] text-on-surface-variant line-clamp-2 leading-relaxed italic">{s.reason}</p>
                    </div>
                    
                    <div className="mt-3 pt-2.5 border-t border-line/30 flex justify-between items-center text-[9px]">
                      <span className="text-on-surface-variant font-medium">Offered by <span className="font-semibold text-ink">{s.providerName?.split(" ")[0] || "Resident"}</span></span>
                      <Link to="/app/skills">
                        <span className="font-bold text-soft-violet hover:underline cursor-pointer">View</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Volunteer Suggestions */}
        <Card className="border-deep-forest/20 shadow-sm bg-gradient-to-br from-deep-forest/5 via-[#fbfaff] to-transparent">
          <CardHeader className="pb-3 border-b border-deep-forest/10">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-deep-forest/10 flex items-center justify-center text-deep-forest border border-deep-forest/20">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-ink">Volunteer Matches</CardTitle>
                  <CardDescription className="text-[10px] text-on-surface-variant">Upcoming events that match your volunteer profile.</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {residentSuggestions.isLoading ? (
              <div className="text-xs text-on-surface-variant">Loading suggestions...</div>
            ) : residentSuggestions.data?.volunteerSuggestions?.length === 0 ? (
              <div className="py-6 text-center text-xs text-on-surface-variant border border-dashed border-line rounded-xl bg-white">
                No matching volunteer roles at the moment.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {residentSuggestions.data?.volunteerSuggestions.map((v: any, idx: number) => (
                  <div key={idx} className="bg-white border border-line/45 p-3.5 rounded-xl flex flex-col justify-between hover:shadow-sm transition-all group">
                    <div className="font-bold text-xs text-ink">{v.title}</div>
                    <div className="text-[10px] mt-1.5 text-on-surface-variant leading-relaxed italic">{v.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notices Board Widget */}
        <Card className="border-line/60 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-line/45">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                  <Megaphone className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-bold text-ink">Broadcast Noticeboard</CardTitle>
              </div>
              <Link to="/app/notices">
                <span className="text-[10px] font-bold text-deep-forest hover:underline cursor-pointer">View All</span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex-1 space-y-3.5">
            {notices.data?.length === 0 ? (
              <div className="py-8 text-center text-xs text-on-surface-variant border border-dashed border-line rounded-xl">
                No active announcements on the board.
              </div>
            ) : (
              notices.data?.slice(0, 3).map((n) => (
                <div key={n.id} className="relative pl-4 border-l-2 border-emerald-500/80 hover:translate-x-[2px] transition-transform duration-200">
                  <div className="text-xs font-bold text-ink leading-snug">{n.title}</div>
                  <div className="text-[10px] text-on-surface-variant mt-1.5 flex items-center gap-1.5">
                    <span className="font-semibold text-deep-forest">{n.postedByName}</span>
                    <span>·</span>
                    <span>{n.date}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Side Column */}
      <div className="lg:col-span-1 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat icon={Wallet} label="Credit Balance" value={`${user!.creditBalance} Crd`} trend={{ value: "Wallet active", type: "neutral" }} />
          <Stat icon={Sparkles} label="Active Services" value={myActive} hint="Approved exchange listings" />
          <Stat icon={AlertCircle} label="Open Issues" value={myOpen} trend={{ value: myOpen === 0 ? "Clean" : `${myOpen} open`, type: myOpen === 0 ? "up" : "down" }} />
          <Stat icon={Calendar} label="Volunteering" value="2" hint="Registered events" />
        </div>

        {/* Transactions ledger Widget */}
        <Card className="border-line/60 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-line/45">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
                  <Activity className="h-4 w-4" />
                </div>
                <CardTitle className="text-base font-bold text-ink">Recent Activity</CardTitle>
              </div>
              <Link to="/app/wallet">
                <span className="text-[10px] font-bold text-deep-forest hover:underline cursor-pointer">Ledger</span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex-1 space-y-4">
            {txs.data?.length === 0 ? (
              <div className="py-8 text-center text-xs text-on-surface-variant border border-dashed border-line rounded-xl">
                No transactions yet.
              </div>
            ) : (
              txs.data?.slice(0, 4).map((t) => (
                <div key={t.id} className="flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                      t.amount > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                    }`}>
                      {t.amount > 0 ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-ink leading-none">{t.description}</div>
                      <div className="text-[10px] text-on-surface-variant mt-1">{t.date}</div>
                    </div>
                  </div>
                  <div className={`text-xs font-bold ${t.amount > 0 ? "text-emerald-700" : "text-ink"}`}>
                    {t.amount > 0 ? "+" : ""}{t.amount}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resident Service Directory Links */}
      <div className="bg-panel border border-line/50 p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-deep-forest/5 flex items-center justify-center text-deep-forest">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-ink">Need to request a service or skill?</div>
            <p className="text-[10px] text-on-surface-variant mt-0.5">Explore active community exchanges from your neighbors.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/app/skills">
            <button className="bg-deep-forest text-white text-[11px] font-semibold px-4 py-2 rounded-lg flex items-center gap-1 cursor-pointer hover:shadow-sm transition-all active:scale-95">
              <Plus className="h-3.5 w-3.5" /> Skill Listings
            </button>
          </Link>
          <Link to="/app/resources">
            <button className="border border-line-strong hover:bg-surface-variant text-ink text-[11px] font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer">
              Shared Tools
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
