import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { eventService } from "@/services";
import { suggestVolunteers, checkEventClash, type VolunteerSuggestion } from "@/services/ai";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Plus, Sparkles, Users, CalendarDays, Clock, MapPin, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventCalendar } from "@/components/calendar/EventCalendar";

export const Route = createFileRoute("/app/coord/events")({ component: Page });

function Page() {
  const { user } = useAuth();
  const sid = user!.societyId!;
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ["ev", sid], queryFn: () => eventService.list(sid) });
  const vrs = useQuery({ queryKey: ["vr", sid], queryFn: () => eventService.listVolunteerRequests(sid) });
  const [open, setOpen] = useState(false);
  
  // Provide default valid dates to ensure datetime-local inputs work correctly across browsers
  const now = new Date();
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const defaultStartTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  const defaultEndTime = new Date(later.getTime() - (later.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

  const [form, setForm] = useState<{ title: string; description: string; startDate: string; startTimeStr: string; endDate: string; endTimeStr: string; volunteersNeeded: number | string; color: string; textColor: string }>({ 
    title: "", 
    description: "", 
    startDate: defaultStartTime.split('T')[0],
    startTimeStr: defaultStartTime.split('T')[1],
    endDate: defaultEndTime.split('T')[0],
    endTimeStr: defaultEndTime.split('T')[1],
    volunteersNeeded: 4,
    color: "#a5d6a7",
    textColor: "#1b4332"
  });

  const COLOR_OPTIONS = [
    { bg: "#a5d6a7", text: "#1b4332" },
    { bg: "#fff3cd", text: "#7c5b00" },
    { bg: "#dce8fb", text: "#1e3a6e" },
    { bg: "#fcd9d9", text: "#7c1a1a" },
    { bg: "#e8d5f7", text: "#4a1a7c" },
  ];
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [checkingClash, setCheckingClash] = useState(false);
  const [clashResult, setClashResult] = useState<{hasClash: boolean, reason: string} | null>(null);

  const renderEventContent = (e: any, isModal: boolean = false) => {
    const reqs = vrs.data?.filter((v) => v.eventId === e.id) ?? [];
    const capacityPct = (e.volunteers.length / (e.volunteersNeeded || 1)) * 100;
    const color = e.status === "upcoming" ? "#b7dfc8" : e.status === "completed" ? "#e2e8f0" : "#dce8fb";

    return (
      <div key={e.id} className={cn("flex flex-col bg-white", isModal ? "" : "rounded-t-2xl")}>
        {/* Colour stripe + header */}
        <div className="relative" style={{ backgroundColor: color }}>
          <div className="px-6 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-[#1a2e1a] text-xl font-semibold tracking-tight leading-snug truncate capitalize">
                  {e.title}
                </h2>
              </div>
            </div>
            <div className="mt-2">
              <Badge className="bg-black/5 border border-black/10 text-[#1a2e1a] text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">
                {e.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Info card */}
          <div className="mx-5 mt-4 bg-[#f7faf7] border border-[#d8edda] rounded-xl overflow-hidden">
            <div className="grid divide-y divide-[#d8edda]">
              <div className="flex items-center gap-3 px-4 py-3">
                <CalendarDays size={15} className="text-[#2d6a4f] shrink-0" />
                <div className="flex-1 flex items-baseline justify-between gap-4">
                  <span className="text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider">Date</span>
                  <span className="text-sm font-medium text-[#1a2e1a]">{new Date(e.startTime).toLocaleDateString()} - {new Date(e.endTime).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Clock size={15} className="text-[#2d6a4f] shrink-0" />
                <div className="flex-1 flex items-baseline justify-between gap-4">
                  <span className="text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider">Time</span>
                  <span className="text-sm font-medium text-[#1a2e1a]">{new Date(e.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} to {new Date(e.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
              <div className="flex items-start gap-3 px-4 py-3">
                <Users size={15} className="text-[#2d6a4f] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider">Capacity</span>
                    <span className="text-sm font-medium text-[#1a2e1a]">{e.volunteers.length} / {e.volunteersNeeded} Volunteers</span>
                  </div>
                  <div className="h-1.5 bg-[#d8edda] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(capacityPct, 100)}%`, backgroundColor: capacityPct >= 90 ? "#d97706" : "#2d6a4f" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-5 mt-4 pt-4 pb-2">
            <span className="text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider block mb-2">Details & Roster Instructions</span>
            <p className="text-sm text-[#1a2e1a] leading-relaxed">{e.description}</p>
          </div>

          <div className="mx-5 mt-1">
             <SuggestButton eventId={e.id} eventTitle={e.title} />
          </div>

          {reqs.length > 0 && (
            <div className="mx-5 mt-4 pt-4 border-t border-line/20 space-y-2 mb-6">
              <span className="text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider block mb-2">Volunteer Roster Status</span>
              <div className="grid gap-2">
                {reqs.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/40 p-3.5 text-sm bg-panel/20">
                    <div>
                      <span className="font-bold text-ink">{r.residentName}</span>
                      <Badge variant="outline" className="ml-2 text-xs font-semibold border-line bg-white text-on-surface-variant uppercase px-2 py-0.5">{r.type}</Badge>
                    </div>
                    <div>
                      {r.status === "left" ? (
                        <div className="text-sm text-rose-800 bg-rose-50 border border-rose-100 rounded-lg px-4 py-2 max-w-sm italic">
                          <span className="font-bold not-italic text-rose-950 block text-xs uppercase tracking-wider mb-0.5">Withdrew from event</span>
                          Reason: "{r.leaveReason || "No reason provided."}"
                        </div>
                      ) : r.type === "self-requested" && r.status === "pending" ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-9 text-xs font-semibold px-3 bg-deep-forest hover:bg-deep-forest/90 text-white cursor-pointer active:scale-98 transition-all" onClick={async () => { await eventService.approveVolunteer(r.id); qc.invalidateQueries(); toast.success("Approved volunteer request!"); }}>Approve</Button>
                          <Button size="sm" variant="outline" className="h-9 text-xs font-semibold px-3 border-line-strong hover:bg-panel cursor-pointer" onClick={async () => { await eventService.rejectVolunteer(r.id); qc.invalidateQueries(); toast.info("Rejected volunteer request."); }}>Reject</Button>
                        </div>
                      ) : r.type === "coordinator-invited" && r.status === "pending" ? (
                        <Badge className="bg-blue-50 border-blue-200 text-blue-800 text-xs uppercase font-bold tracking-wider px-2 py-0.5 border">
                          Invited (Pending Response)
                        </Badge>
                      ) : (
                        <Badge className={cn(
                          "text-xs uppercase font-bold border px-2 py-0.5",
                          r.status === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                        )}>
                          {r.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {reqs.length === 0 && <div className="h-6"></div>}
        </div>
      </div>
    );
  };

  const renderEventCard = (e: any) => {
    return (
      <Card key={e.id} className="border-line/60 shadow-[0_4px_20px_-4px_rgba(16,86,68,0.04)] hover:shadow-[0_12px_30px_-6px_rgba(16,86,68,0.1)] hover:-translate-y-0.5 transition-all duration-300 bg-white mb-4 overflow-hidden rounded-2xl">
        {renderEventContent(e, false)}
      </Card>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-page-fade">
      <PageHeader 
        title="Events Board" 
        description="Schedule upcoming society assemblies, analyze profiles to recruit volunteers, and moderate signups." 
        action={
          <Dialog open={open} onOpenChange={setOpen} modal={false}>
            <DialogTrigger asChild>
              <Button className="bg-deep-forest hover:bg-deep-forest/90 text-white font-semibold text-xs h-10 px-4 rounded-lg shadow-sm cursor-pointer active:scale-98 transition-all">
                <Plus className="mr-1.5 h-4 w-4" /> Create Event
              </Button>
            </DialogTrigger>
            <DialogContent 
              onInteractOutside={(e) => {}}
              onEscapeKeyDown={(e) => {}}
              onPointerDownOutside={(e) => {}}
              onFocusOutside={(e) => { e.preventDefault(); }}
              className="sm:max-w-lg border-none shadow-2xl rounded-2xl overflow-hidden bg-white p-0 [&>button]:hidden"
            >
              <div className="bg-[#1b4332] px-6 py-5 flex items-start justify-between">
                <div>
                  <h2 className="text-white text-lg font-semibold tracking-tight">Create Event</h2>
                  <p className="text-[#a5d6a7] text-sm mt-0.5">Add a new event to the board</p>
                </div>
                <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white mt-0.5 transition-colors focus:outline-none cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
                <div>
                  <label className="block text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider mb-1.5">Event Title</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Community Park Clean-Up" className="w-full border border-[#d8edda] rounded-lg px-3 py-2 text-sm text-[#1a2e1a] bg-[#f2f6f2] focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20 focus:border-[#1b4332]" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider mb-1.5">Start Date</label>
                    <input type="date" value={form.startDate} onChange={(e) => { setForm({ ...form, startDate: e.target.value }); setClashResult(null); }} className="w-full border border-[#d8edda] rounded-lg px-3 py-2 text-sm text-[#1a2e1a] bg-[#f2f6f2] focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20 focus:border-[#1b4332] h-[38px]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider mb-1.5">End Date</label>
                    <input type="date" value={form.endDate} min={form.startDate} onChange={(e) => { setForm({ ...form, endDate: e.target.value }); setClashResult(null); }} className="w-full border border-[#d8edda] rounded-lg px-3 py-2 text-sm text-[#1a2e1a] bg-[#f2f6f2] focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20 focus:border-[#1b4332] h-[38px]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider mb-1.5">Start Time</label>
                    <input type="time" value={form.startTimeStr} onChange={(e) => setForm({ ...form, startTimeStr: e.target.value })} className="w-full border border-[#d8edda] rounded-lg px-3 py-2 text-sm text-[#1a2e1a] bg-[#f2f6f2] focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20 focus:border-[#1b4332] h-[38px]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider mb-1.5">End Time</label>
                    <input type="time" value={form.endTimeStr} onChange={(e) => setForm({ ...form, endTimeStr: e.target.value })} className="w-full border border-[#d8edda] rounded-lg px-3 py-2 text-sm text-[#1a2e1a] bg-[#f2f6f2] focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20 focus:border-[#1b4332] h-[38px]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider mb-1.5">Capacity</label>
                    <input type="number" min="1" value={form.volunteersNeeded} onChange={(e) => setForm({ ...form, volunteersNeeded: e.target.value === "" ? "" : Number(e.target.value) })} className="w-full border border-[#d8edda] rounded-lg px-3 py-2 text-sm text-[#1a2e1a] bg-[#f2f6f2] focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20 focus:border-[#1b4332] h-[38px]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider mb-1.5">Color</label>
                    <div className="flex gap-2 items-center h-[38px]">
                      {COLOR_OPTIONS.map(c => (
                        <button key={c.bg} type="button" onClick={() => setForm({...form, color: c.bg, textColor: c.text})}
                          className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
                          style={{ backgroundColor: c.bg, borderColor: form.color === c.bg ? c.text : "transparent", boxShadow: form.color === c.bg ? `0 0 0 2px ${c.text}33` : "none" }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider mb-1.5">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Provide event goals, location details, etc..." className="w-full border border-[#d8edda] rounded-lg px-3 py-2 text-sm text-[#1a2e1a] bg-[#f2f6f2] focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20 focus:border-[#1b4332] min-h-[80px]" />
                </div>
                
                <div className="space-y-2 pt-2">
                  <button 
                    type="button"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#d8edda] text-sm font-medium text-[#1a2e1a] hover:bg-[#f2f6f2] disabled:opacity-60 transition-colors cursor-pointer"
                    disabled={!form.title || !form.startDate || !form.startTimeStr || !form.endDate || !form.endTimeStr || checkingClash}
                    onClick={async () => {
                      setCheckingClash(true);
                      try {
                        const res = await checkEventClash({
                          title: form.title,
                          description: form.description,
                          startTime: new Date(`${form.startDate}T${form.startTimeStr}`).toISOString(),
                          endTime: new Date(`${form.endDate}T${form.endTimeStr}`).toISOString(),
                          societyId: sid
                        });
                        setClashResult(res);
                      } catch (err) {
                        toast.error("Failed to run AI check.");
                      } finally {
                        setCheckingClash(false);
                      }
                    }}
                  >
                    {checkingClash ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-[#d8edda] border-t-[#2d6a4f] rounded-full animate-spin" />
                        Checking for clashes…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="text-violet-500" />
                        AI Check for Clashes
                      </>
                    )}
                  </button>
                  
                  {clashResult && (
                    <div className={cn(
                      "flex gap-2.5 px-3.5 py-3 rounded-lg border",
                      clashResult.hasClash ? "bg-red-50 border-red-200" : "bg-[#f2f6f2] border-[#d8edda]"
                    )}>
                      <span className="text-sm leading-none mt-px">{clashResult.hasClash ? "⚠️" : "✅"}</span>
                      <div>
                        <p className={cn("text-xs font-semibold uppercase tracking-wide", clashResult.hasClash ? "text-red-700" : "text-[#2d6a4f]")}>
                          {clashResult.hasClash ? "Clash Detected" : "All Clear"}
                        </p>
                        <p className={cn("text-xs mt-0.5 leading-relaxed", clashResult.hasClash ? "text-red-600" : "text-[#5a7a5a]")}>
                          {clashResult.reason}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setOpen(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-[#d8edda] text-sm text-[#5a7a5a] font-medium hover:bg-[#f2f6f2] transition-colors cursor-pointer">Cancel</button>
                  <button type="button" className="flex-1 px-4 py-2.5 rounded-lg bg-[#1b4332] text-white text-sm font-medium hover:bg-[#14532d] transition-colors cursor-pointer" onClick={async () => {
                    try {
                      await eventService.create({ 
                        title: form.title, 
                        description: form.description, 
                        startTime: new Date(`${form.startDate}T${form.startTimeStr}`).toISOString(), 
                        endTime: new Date(`${form.endDate}T${form.endTimeStr}`).toISOString(), 
                        volunteersNeeded: form.volunteersNeeded === "" ? 0 : Number(form.volunteersNeeded), 
                        createdByCoordinatorId: user!.id,
                        societyId: sid,
                        color: form.color,
                        textColor: form.textColor
                      });
                      qc.invalidateQueries({ queryKey: ["ev", sid] });
                      setOpen(false);
                      toast.success("Event created successfully!");
                    } catch (err: any) {
                      if (err.message && err.message.includes("400")) {
                        toast.error("Event time overlaps with another society event.");
                      } else {
                        toast.error("Failed to create event. Please check inputs.");
                      }
                    }
                  }}>Create Event</button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        } 
      />

      <EventCalendar 
        events={events.data || []}
        defaultView="Month"
        onEventClick={(e) => setSelectedEvent(e)}
        renderSchedule={() => (
          <div className="space-y-4">
            {events.data?.map(renderEventCard)}
          </div>
        )}
      />

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-[700px] border-none shadow-2xl rounded-2xl overflow-hidden bg-white max-h-[85vh] overflow-y-auto p-0 [&>button]:hidden">
          {selectedEvent && renderEventContent(selectedEvent, true)}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SuggestButton({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [items, setItems] = useState<VolunteerSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-[#d8edda] bg-white hover:bg-[#f7faf7] transition-colors group cursor-pointer"
          onClick={async () => {
            setLoading(true);
            try {
              setItems(await suggestVolunteers(eventId));
            } catch {
              toast.error("Failed to fetch suggestions.");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shrink-0">
              <Sparkles size={13} className="text-white" />
            </div>
            <span className="text-sm font-medium text-[#1a2e1a]">AI Invite Recommendations</span>
          </div>
          <ChevronDown size={15} className="text-[#5a7a5a] transition-transform group-hover:text-[#1a2e1a]" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md border-line/60 rounded-2xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        <DialogHeader className="pb-3 border-b border-line/35">
          <DialogTitle className="text-base font-bold text-ink">AI Volunteer Matchmaker</DialogTitle>
          <span className="text-xs text-on-surface-variant">Recommended residents with skills or interest matches matching event description.</span>
        </DialogHeader>
        <div className="space-y-3 pt-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
          {loading ? (
            <div className="py-6 text-center text-xs text-on-surface-variant">Running match recommendation agent...</div>
          ) : items.map((s) => (
            <div key={s.user.id} className="flex items-center justify-between gap-4 rounded-xl border border-line/40 p-3 bg-panel/15 text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-ink">{s.user.name}</div>
                <div className="text-[10px] text-on-surface-variant font-medium">{s.reason}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50 text-[9px] font-bold">{s.score}% Match</Badge>
                <Button size="sm" className="h-[28px] text-[10px] font-semibold px-3 bg-deep-forest hover:bg-deep-forest/90 text-white cursor-pointer active:scale-98 transition-all" onClick={async () => {
                  await eventService.inviteVolunteer(eventId, s.user.id, s.user.name, eventTitle);
                  qc.invalidateQueries();
                  toast.success(`Invited ${s.user.name}!`);
                }}>Invite</Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
