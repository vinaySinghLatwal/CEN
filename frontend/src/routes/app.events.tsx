import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { eventService } from "@/services";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventCalendar } from "@/components/calendar/EventCalendar";

export const Route = createFileRoute("/app/events")({ component: Page });

function Page() {
  const { user } = useAuth();
  const sid = user!.societyId!;
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ["ev", sid], queryFn: () => eventService.list(sid) });
  const vrs = useQuery({ queryKey: ["vr", sid], queryFn: () => eventService.listVolunteerRequests(sid) });
  const myInvites = vrs.data?.filter((v) => v.residentId === user!.id && v.type === "coordinator-invited" && v.status === "pending") ?? [];

  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const renderEventCard = (e: any) => {
    const iAmIn = e.volunteers.includes(user!.id);
    const mySelfReq = vrs.data?.find((v) => v.eventId === e.id && v.residentId === user!.id && v.type === "self-requested");
    
    return (
      <Card key={e.id} className="border-line/60 shadow-[0_4px_20px_-4px_rgba(16,86,68,0.04)] hover:shadow-[0_12px_30px_-6px_rgba(16,86,68,0.1)] hover:-translate-y-0.5 transition-all duration-300 bg-white flex flex-col justify-between overflow-hidden">
        <CardContent className="p-6 flex flex-col justify-between flex-1 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-deep-forest/5 text-deep-forest border border-deep-forest/15 flex items-center justify-center flex-shrink-0">
                  <CalendarIcon className="h-4.5 w-4.5" />
                </div>
                <h3 className="font-bold text-base sm:text-lg text-ink leading-snug">{e.title}</h3>
              </div>
              <Badge className="bg-deep-forest/5 text-deep-forest border border-deep-forest/15 uppercase text-xs font-bold tracking-wider px-2 py-0.5 rounded pointer-events-none">
                {e.status}
              </Badge>
            </div>
            <div className="text-xs text-on-surface-variant font-medium pt-1">Planned: <span className="font-semibold text-ink">{new Date(e.startTime).toLocaleString()} - {new Date(e.endTime).toLocaleTimeString()}</span> · Roster: <span className="font-semibold text-ink">{e.volunteers.length} / {e.volunteersNeeded}</span> Volunteers</div>
            <p className="text-sm text-on-surface-variant leading-relaxed pt-1 line-clamp-3">{e.description}</p>
          </div>

          <div className="pt-3 border-t border-line/20 mt-auto flex justify-between items-center">
            {iAmIn ? (
              <div className="flex items-center justify-between w-full gap-2">
                <Badge className="bg-emerald-50 border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider h-9 px-3 border"><Users className="mr-1.5 h-3.5 w-3.5" /> Volunteering</Badge>
                <LeaveEventDialog eventId={e.id} eventTitle={e.title} />
              </div>
            ) : mySelfReq ? (
              <Badge variant="outline" className={cn(
                "text-xs font-bold uppercase tracking-wider h-9 px-3 border",
                mySelfReq.status === "pending" ? "bg-amber-50 border-amber-200 text-amber-800" :
                mySelfReq.status === "rejected" ? "bg-rose-50 border-rose-200 text-rose-800" :
                mySelfReq.status === "left" ? "bg-slate-50 border-slate-200 text-slate-800" :
                "bg-slate-50 border-slate-200 text-slate-800"
              )}>
                Request: {mySelfReq.status}
              </Badge>
            ) : (
              <Button size="sm" className="bg-deep-forest hover:bg-deep-forest/90 text-white font-semibold h-9 rounded-lg text-xs cursor-pointer shadow-sm active:scale-98 transition-all px-4" onClick={async () => {
                await eventService.requestVolunteer(e.id, user!.id, user!.name, e.title);
                qc.invalidateQueries();
                toast.success("Volunteer request sent");
              }}>Request to Volunteer</Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-page-fade">
      <PageHeader title="Community Events" description="Participate, volunteer, or accept invitations for upcoming community assemblies." />
      
      {myInvites.length > 0 && (
        <div className="rounded-xl border border-dashed border-purple-300 bg-purple-50/50 p-5 space-y-3">
          <div className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-ping"></span>
            Volunteer Invitations ({myInvites.length})
          </div>
          <div className="space-y-2">
            {myInvites.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-4 text-xs font-medium bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                <span className="text-ink font-semibold">"{v.eventTitle}"</span>
                <div className="flex gap-2">
                  <Button size="sm" className="h-[28px] text-[10px] font-semibold px-3 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer active:scale-98 transition-all" onClick={async () => { await eventService.approveVolunteer(v.id); qc.invalidateQueries(); toast.success("Accepted invitation!"); }}>Accept</Button>
                  <Button size="sm" variant="outline" className="h-[28px] text-[10px] font-semibold px-3 border-purple-200 text-purple-700 hover:bg-purple-50 cursor-pointer" onClick={async () => { await eventService.rejectVolunteer(v.id); qc.invalidateQueries(); toast.info("Declined invitation."); }}>Decline</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <EventCalendar 
        events={events.data || []}
        defaultView="month"
        onEventClick={(e) => setSelectedEvent(e)}
        renderSchedule={() => (
          <div className="grid gap-4 md:grid-cols-2">
            {events.data?.map(renderEventCard)}
          </div>
        )}
      />

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-[600px] p-0 border-line/60 rounded-2xl overflow-hidden bg-surface-variant/20">
          {selectedEvent && (
            <div className="p-4 sm:p-6">
              {renderEventCard(selectedEvent)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeaveEventDialog({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs font-semibold h-8 px-3 text-rose-600 hover:bg-rose-50 border-line-strong hover:border-rose-200 cursor-pointer">
          Leave Event
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md border-line/60 rounded-2xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        <DialogHeader className="pb-3 border-b border-line/35">
          <DialogTitle className="text-base font-bold text-ink">Withdraw from Event</DialogTitle>
          <span className="text-xs text-on-surface-variant">Are you sure you want to stop volunteering for <span className="font-bold text-ink">"{eventTitle}"</span>?</span>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Reason for Leaving</Label>
            <Textarea 
              rows={3} 
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              placeholder="e.g. Unforeseen schedule conflict, personal reasons..."
              className="border-line-strong focus:ring-1 focus:ring-deep-forest/20 text-xs rounded-lg p-3"
            />
          </div>
          <Button 
            disabled={!reason.trim() || loading}
            onClick={async () => {
              setLoading(true);
              try {
                await eventService.leave(eventId, user!.id, reason);
                qc.invalidateQueries();
                toast.info(`Withdrew from event "${eventTitle}".`);
                setOpen(false);
              } catch {
                toast.error("Failed to withdraw.");
              } finally {
                setLoading(false);
              }
            }}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-10 rounded-lg shadow-sm cursor-pointer mt-2 active:scale-98 transition-all"
          >
            {loading ? "Withdrawing..." : "Confirm Withdrawal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
