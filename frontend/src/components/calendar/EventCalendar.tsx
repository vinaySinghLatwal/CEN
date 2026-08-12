import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isSameDay, startOfDay } from "date-fns";

export type CalendarViewType = "Month" | "Week" | "Schedule";

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  status?: string;
  color?: string;
  textColor?: string;
  [key: string]: any;
}

interface EventCalendarProps {
  events: CalendarEvent[];
  defaultView?: CalendarViewType;
  renderSchedule?: () => React.ReactNode;
  onEventClick?: (event: CalendarEvent) => void;
  renderEventContent?: (event: CalendarEvent) => React.ReactNode;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getCalendarGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  let current = new Date(year, month, 1 - startOffset);
  const weeks: Date[][] = [];
  for (let r = 0; r < 6; r++) {
    const w: Date[] = [];
    for (let c = 0; c < 7; c++) {
      w.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(w);
  }
  return weeks;
}

function getEventsForWeek(events: CalendarEvent[], week: Date[]) {
  const ws = startOfDay(week[0]);
  const we = startOfDay(week[6]);
  return events.filter(ev => {
    const s = startOfDay(new Date(ev.startTime));
    const e = startOfDay(new Date(ev.endTime));
    return s <= we && e >= ws;
  }).map(ev => {
    const s = startOfDay(new Date(ev.startTime));
    const e = startOfDay(new Date(ev.endTime));
    const colStart = Math.max(0, Math.round((s.getTime() - ws.getTime()) / 86400000));
    const colEnd = Math.min(6, Math.round((e.getTime() - ws.getTime()) / 86400000));
    return { ...ev, colStart, colEnd };
  });
}

function EventPill({
  ev, onClick, isStart, isEnd,
}: {
  ev: CalendarEvent & { colStart: number; colEnd: number };
  onClick: () => void;
  isStart: boolean;
  isEnd: boolean;
}) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(); }}
      className="absolute flex items-center cursor-pointer select-none group"
      style={{
        top: 0,
        left: `calc(${ev.colStart / 7 * 100}% + ${isStart ? 3 : 0}px)`,
        width: `calc(${(ev.colEnd - ev.colStart + 1) / 7 * 100}% - ${isStart ? 3 : 0}px - ${isEnd ? 3 : 0}px)`,
        height: 22,
        zIndex: 10,
      }}
    >
      <div
        className="w-full h-full flex items-center px-2 text-xs font-medium truncate transition-opacity group-hover:opacity-75"
        style={{
          backgroundColor: ev.color || "#a5d6a7",
          color: ev.textColor || "#1b4332",
          borderRadius: `${isStart ? "5px" : "0"} ${isEnd ? "5px" : "0"} ${isEnd ? "5px" : "0"} ${isStart ? "5px" : "0"}`,
        }}
      >
        {isStart ? ev.title : ""}
      </div>
    </div>
  );
}

function WeekRow({ week, events, currentMonth, today, onDayClick, onEventClick }: {
  week: Date[];
  events: CalendarEvent[];
  currentMonth: number;
  today: Date;
  onDayClick: (d: Date) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const weekEvents = getEventsForWeek(events, week);
  type SlottedEvent = typeof weekEvents[0] & { row: number };
  const slotted: SlottedEvent[] = [];
  const rowEndCols: number[] = [];

  for (const ev of weekEvents) {
    let row = 0;
    while (rowEndCols[row] !== undefined && rowEndCols[row] >= ev.colStart) row++;
    rowEndCols[row] = ev.colEnd;
    slotted.push({ ...ev, row });
  }

  const MAX_ROWS = 2;

  return (
    <div className="grid grid-cols-7 border-b border-[#e5e7eb]/60 last:border-b-0" style={{ minHeight: 96 }}>
      {week.map((day, di) => {
        const isToday = isSameDay(day, today);
        const isCurrentMonth = day.getMonth() === currentMonth;
        const overflowCount = slotted.filter(ev => ev.row >= MAX_ROWS && di >= ev.colStart && di <= ev.colEnd).length;
        return (
          <div
            key={di}
            className={`relative border-r border-[#e5e7eb]/60 last:border-r-0 cursor-pointer group ${!isCurrentMonth ? "bg-[#edf3ed]" : ""}`}
            onClick={() => onDayClick(day)}
            style={{ minHeight: 96 }}
          >
            <div className="flex items-start justify-end p-1.5 pb-0">
              <span className={`w-6 h-6 flex items-center justify-center text-xs rounded-full font-medium transition-colors
                ${isToday ? "bg-[#1b4332] text-white" : ""}
                ${!isToday && isCurrentMonth ? "text-[#1a2e1a] group-hover:bg-[#d8edda]" : ""}
                ${!isCurrentMonth ? "text-[#aabcaa]" : ""}`}>
                {day.getDate()}
              </span>
            </div>
            {overflowCount > 0 && (
              <div className="absolute bottom-1.5 right-1.5 text-[10px] text-[#5a7a5a] font-semibold">+{overflowCount} more</div>
            )}
          </div>
        );
      })}
      <div className="col-span-7 pointer-events-none" style={{ position: "relative", height: 0 }}>
        <div className="absolute inset-x-0 pointer-events-auto" style={{ top: -96 + 28, height: MAX_ROWS * 26 }}>
          {slotted.filter(ev => ev.row < MAX_ROWS).map((ev, i) => {
            const evStartDay = startOfDay(new Date(ev.startTime));
            const evEndDay = startOfDay(new Date(ev.endTime));
            const weekStart = startOfDay(week[0]);
            const weekEnd = startOfDay(week[6]);
            const isStart = evStartDay >= weekStart;
            const isEnd = evEndDay <= weekEnd;
            return (
              <div key={`${ev.id}-${i}`} className="absolute pointer-events-auto" style={{ top: ev.row * 26, left: 0, right: 0, height: 22 }}>
                <EventPill ev={ev} isStart={isStart} isEnd={isEnd} onClick={() => onEventClick(ev)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function EventCalendar({
  events,
  defaultView = "Month",
  renderSchedule,
  onEventClick,
}: EventCalendarProps) {
  const today = startOfDay(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>(defaultView);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const weeks = getCalendarGrid(year, month);

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); }
  function goToday() { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); }

  if (view === "Schedule") {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e7eb]/60 shadow-sm p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 bg-[#f2f6f2] rounded-lg p-1">
            {(["Month", "Week", "Schedule"] as const).map(v => (
              <button key={v} onClick={() => setView(v as CalendarViewType)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${view === v ? "bg-white text-[#1a2e1a] shadow-sm" : "text-[#5a7a5a] hover:text-[#1a2e1a]"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        {renderSchedule && renderSchedule()}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb]/60 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7eb]/60 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="px-3 py-1.5 rounded-lg border border-[#e5e7eb]/60 text-sm text-[#1a2e1a] font-medium hover:bg-[#f2f6f2] transition-colors cursor-pointer">Today</button>
          <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f2f6f2] transition-colors text-[#5a7a5a] cursor-pointer"><ChevronLeft size={16} /></button>
          <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f2f6f2] transition-colors text-[#5a7a5a] cursor-pointer"><ChevronRight size={16} /></button>
          <span className="text-[#1a2e1a] text-sm font-semibold ml-1">{MONTH_NAMES[month]} {year}</span>
        </div>
        <div className="flex items-center gap-1 bg-[#f2f6f2] rounded-lg p-1">
          {(["Month", "Week", "Schedule"] as const).map(v => (
            <button key={v} onClick={() => setView(v as CalendarViewType)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer
                ${view === v ? "bg-white text-[#1a2e1a] shadow-sm" : "text-[#5a7a5a] hover:text-[#1a2e1a]"}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[#e5e7eb]/60 shrink-0 bg-[#fafafa]">
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold text-[#5a7a5a] uppercase tracking-wider border-r border-[#e5e7eb]/60 last:border-r-0">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1 flex flex-col overflow-auto">
        {weeks.map((week, wi) => (
          <WeekRow key={wi} week={week} events={events} currentMonth={month} today={today}
            onDayClick={() => {}}
            onEventClick={onEventClick || (() => {})} />
        ))}
      </div>
    </div>
  );
}
