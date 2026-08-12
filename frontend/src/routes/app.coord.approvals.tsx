import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { skillService, resourceService } from "@/services";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

import { noticeService } from "@/services";

export const Route = createFileRoute("/app/coord/approvals")({ component: Page });

function Page() {
  const { user } = useAuth();
  const sid = user!.societyId!;
  const skills = useQuery({ queryKey: ["pSkills", sid], queryFn: () => skillService.listPending(sid) });
  const res = useQuery({ queryKey: ["pRes", sid], queryFn: () => resourceService.listPending(sid) });
  const notices = useQuery({ queryKey: ["notices", sid], queryFn: () => noticeService.list(sid) });
  
  const skillsToReview = skills.data?.filter((s) => s.providerId !== user!.id) ?? [];
  const resToReview = res.data?.filter((r) => r.ownerId !== user!.id) ?? [];
  const mySkills = skills.data?.filter((s) => s.providerId === user!.id) ?? [];
  const myRes = res.data?.filter((r) => r.ownerId === user!.id) ?? [];
  const insights = notices.data?.filter((n) => n.category === "Coordinator Insight") ?? [];

  return (
    <div className="space-y-6 pb-12 animate-page-fade">
      <PageHeader title="Approvals Hub" description="Review submissions from residents and other coordinators. You cannot approve your own." />
      <Tabs defaultValue="insights" className="w-full">
        <TabsList className="bg-panel/40 p-1 rounded-xl border border-line">
          <TabsTrigger value="insights" className="rounded-lg text-xs font-semibold px-4 py-2 cursor-pointer transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Member Insights ({insights.length})
          </TabsTrigger>
          <TabsTrigger value="skills" className="rounded-lg text-xs font-semibold px-4 py-2 cursor-pointer transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Skills ({skillsToReview.length})
          </TabsTrigger>
          <TabsTrigger value="resources" className="rounded-lg text-xs font-semibold px-4 py-2 cursor-pointer transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Resources ({resToReview.length})
          </TabsTrigger>
          <TabsTrigger value="mine" className="rounded-lg text-xs font-semibold px-4 py-2 cursor-pointer transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">
            My Submissions
          </TabsTrigger>
        </TabsList>
        <div className="h-4" />
        <TabsContent value="insights" className="animate-page-fade">
          <InsightsList items={insights} />
        </TabsContent>
        <TabsContent value="skills" className="animate-page-fade"><SkillsList items={skillsToReview} /></TabsContent>
        <TabsContent value="resources" className="animate-page-fade"><ResList items={resToReview} /></TabsContent>
        <TabsContent value="mine" className="animate-page-fade space-y-4">
          <div className="rounded-xl border border-dashed border-deep-forest/30 bg-deep-forest/5 p-4 text-xs">
            Your own listings are routed to a different coordinator to preserve neutral audit trails.
          </div>
          <SkillsList items={mySkills} readonly />
          <ResList items={myRes} readonly />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InsightsList({ items }: { items: any[] }) {
  return (
    <div className="space-y-3">
      {items.map((insight) => (
        <Card key={insight.id} className="border-indigo-200 shadow-sm bg-gradient-to-br from-indigo-50/50 via-white to-transparent">
          <CardContent className="p-5">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-ink">{insight.title}</h3>
                <Badge className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[9px] uppercase font-bold tracking-wider">AI Insight</Badge>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {insight.content}
              </p>
              <div className="text-[10px] text-on-surface-variant mt-2 font-medium">
                Generated {new Date(insight.date).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {items.length === 0 && <div className="py-8 text-center text-xs text-on-surface-variant border border-dashed border-line rounded-xl bg-white">No insights available.</div>}
    </div>
  );
}

function SkillsList({ items, readonly }: { items: import("@/mocks/data").Skill[]; readonly?: boolean }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<{ type: "approve" | "reject"; id: string; title: string } | null>(null);

  return (
    <div className="space-y-3">
      {items.map((s) => (
        <Card key={s.id} className="border-line/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-sm text-ink">{s.title}</h3>
                  <Badge variant="outline" className="text-[9px] border-line font-medium text-on-surface-variant bg-panel/30 uppercase">{s.category}</Badge>
                  <Badge className="bg-deep-forest/10 border border-deep-forest/20 text-deep-forest text-[9px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wider">{s.credits} credits</Badge>
                </div>
                <div className="text-[10px] text-on-surface-variant font-medium">Submitted by <span className="font-bold text-ink">{s.providerName}</span></div>
                <p className="text-xs text-on-surface-variant leading-relaxed pt-1 pr-6">{s.description}</p>
              </div>
              {!readonly && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setConfirm({ type: "approve", id: s.id, title: s.title })} className="bg-deep-forest hover:bg-deep-forest/90 text-white font-semibold text-xs h-[32px] px-3.5 cursor-pointer shadow-sm active:scale-98 transition-all">Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirm({ type: "reject", id: s.id, title: s.title })} className="text-xs font-semibold h-[32px] px-3.5 border-line-strong hover:bg-panel cursor-pointer active:scale-98 transition-all">Reject</Button>
                </div>
              )}
              {readonly && <Badge variant="secondary" className="pointer-events-none uppercase text-[8.5px] font-bold">Pending Review</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}
      {items.length === 0 && <div className="py-8 text-center text-xs text-on-surface-variant border border-dashed border-line rounded-xl bg-white">Nothing to review.</div>}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="bg-white border-line/60 rounded-2xl shadow-xl max-w-sm p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-base font-bold text-ink flex items-center gap-2">
              {confirm?.type === "approve" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  Approve Skill Listing
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                  Reject Skill Listing
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-on-surface-variant leading-relaxed">
              {confirm?.type === "approve" 
                ? `Are you sure you want to approve the skill "${confirm?.title}" to be listed in the marketplace?`
                : `Are you sure you want to reject the listing request for "${confirm?.title}"?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex gap-2">
            <AlertDialogCancel className="h-9 px-4 text-xs font-semibold rounded-lg border-line-strong hover:bg-panel cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                if (confirm) {
                  if (confirm.type === "approve") {
                    await skillService.approve(confirm.id);
                    toast.success("Skill listing approved and live");
                  } else {
                    await skillService.reject(confirm.id);
                    toast.info("Skill listing rejected");
                  }
                  qc.invalidateQueries();
                  setConfirm(null);
                }
              }}
              className={cn(
                "h-9 px-4 text-xs font-semibold rounded-lg text-white cursor-pointer active:scale-98 transition-all",
                confirm?.type === "approve" ? "bg-deep-forest hover:bg-deep-forest/90" : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ResList({ items, readonly }: { items: import("@/mocks/data").Resource[]; readonly?: boolean }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<{ type: "approve" | "reject"; id: string; title: string } | null>(null);

  return (
    <div className="space-y-3">
      {items.map((r) => (
        <Card key={r.id} className="border-line/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-sm text-ink">{r.name}</h3>
                  <Badge variant="outline" className="text-[9px] border-line font-medium text-on-surface-variant bg-panel/30 uppercase">{r.category}</Badge>
                  <Badge className="bg-deep-forest/10 border border-deep-forest/20 text-deep-forest text-[9px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wider">{r.credits} credits</Badge>
                </div>
                <div className="text-[10px] text-on-surface-variant font-medium">Submitted by <span className="font-bold text-ink">{r.ownerName}</span></div>
                <p className="text-xs text-on-surface-variant leading-relaxed pt-1 pr-6">{r.description}</p>
              </div>
              {!readonly && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setConfirm({ type: "approve", id: r.id, title: r.name })} className="bg-deep-forest hover:bg-deep-forest/90 text-white font-semibold text-xs h-[32px] px-3.5 cursor-pointer shadow-sm active:scale-98 transition-all">Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirm({ type: "reject", id: r.id, title: r.name })} className="text-xs font-semibold h-[32px] px-3.5 border-line-strong hover:bg-panel cursor-pointer active:scale-98 transition-all">Reject</Button>
                </div>
              )}
              {readonly && <Badge variant="secondary" className="pointer-events-none uppercase text-[8.5px] font-bold">Pending Review</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}
      {items.length === 0 && <div className="py-8 text-center text-xs text-on-surface-variant border border-dashed border-line rounded-xl bg-white">Nothing to review.</div>}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="bg-white border-line/60 rounded-2xl shadow-xl max-w-sm p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-base font-bold text-ink flex items-center gap-2">
              {confirm?.type === "approve" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  Approve Resource Listing
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                  Reject Resource Listing
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-on-surface-variant leading-relaxed">
              {confirm?.type === "approve" 
                ? `Are you sure you want to approve the resource "${confirm?.title}" to be listed in the marketplace?`
                : `Are you sure you want to reject the sharing request for "${confirm?.title}"?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex gap-2">
            <AlertDialogCancel className="h-9 px-4 text-xs font-semibold rounded-lg border-line-strong hover:bg-panel cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                if (confirm) {
                  if (confirm.type === "approve") {
                    await resourceService.approve(confirm.id);
                    toast.success("Resource listing approved and live");
                  } else {
                    await resourceService.reject(confirm.id);
                    toast.info("Resource listing rejected");
                  }
                  qc.invalidateQueries();
                  setConfirm(null);
                }
              }}
              className={cn(
                "h-9 px-4 text-xs font-semibold rounded-lg text-white cursor-pointer active:scale-98 transition-all",
                confirm?.type === "approve" ? "bg-deep-forest hover:bg-deep-forest/90" : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
