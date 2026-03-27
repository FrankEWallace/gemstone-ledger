import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  addDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  format,
  isSameDay,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, CalendarRange } from "lucide-react";
import { toast } from "sonner";

import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { PlannedShift, Worker } from "@/lib/supabaseTypes";
import { getWorkers } from "@/services/team.service";
import {
  getPlannedShifts,
  createPlannedShift,
  deletePlannedShift,
  type PlannedShiftPayload,
} from "@/services/schedule.service";

// ─── Schema ──────────────────────────────────────────────────────────────────

const shiftSchema = z.object({
  worker_id: z.string().min(1, "Worker is required"),
  shift_date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  notes: z.string().optional(),
}).refine((d) => d.end_time > d.start_time, {
  message: "End time must be after start time",
  path: ["end_time"],
});

type ShiftFormValues = z.infer<typeof shiftSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shiftDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - sh * 60 - sm;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ─── Add Shift Modal ──────────────────────────────────────────────────────────

interface AddShiftModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  workers: Worker[];
  defaultDate?: string;
}

function AddShiftModal({ open, onClose, siteId, workers, defaultDate }: AddShiftModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      worker_id: "",
      shift_date: defaultDate ?? format(new Date(), "yyyy-MM-dd"),
      start_time: "07:00",
      end_time: "15:00",
      notes: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: ShiftFormValues) => {
      const payload: PlannedShiftPayload = {
        worker_id: values.worker_id,
        shift_date: values.shift_date,
        start_time: values.start_time,
        end_time: values.end_time,
        notes: values.notes || undefined,
      };
      return createPlannedShift(siteId, payload, user?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planned-shifts", siteId] });
      toast.success("Shift scheduled.");
      onClose();
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Shift</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="worker_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Worker *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select worker…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {workers.filter((w) => w.status === "active").map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.full_name}
                          {w.position ? ` — ${w.position}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shift_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Night shift cover" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Schedule Shift"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shift Chip ───────────────────────────────────────────────────────────────

function ShiftChip({
  shift,
  workerName,
  onDelete,
}: {
  shift: PlannedShift;
  workerName: string;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group relative rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-xs">
      <p className="font-medium text-primary truncate">{workerName}</p>
      <p className="text-muted-foreground tabular-nums">
        {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
        {" "}
        <span className="opacity-70">({shiftDuration(shift.start_time, shift.end_time)})</span>
      </p>
      <button
        className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center h-4 w-4 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        onClick={() => onDelete(shift.id)}
        title="Remove shift"
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ViewMode = "week" | "month";

export default function ShiftSchedulePage() {
  const { activeSiteId } = useSite();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();

  // Date range for current view
  const rangeStart = viewMode === "week" ? startOfWeek(anchor, { weekStartsOn: 1 }) : startOfMonth(anchor);
  const rangeEnd   = viewMode === "week" ? endOfWeek(anchor, { weekStartsOn: 1 })   : endOfMonth(anchor);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers", activeSiteId],
    queryFn: () => getWorkers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["planned-shifts", activeSiteId, format(rangeStart, "yyyy-MM-dd"), format(rangeEnd, "yyyy-MM-dd")],
    queryFn: () => getPlannedShifts(activeSiteId!, format(rangeStart, "yyyy-MM-dd"), format(rangeEnd, "yyyy-MM-dd")),
    enabled: !!activeSiteId,
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deletePlannedShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planned-shifts", activeSiteId] });
      toast.success("Shift removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w.full_name]));

  function shiftsForDay(day: Date): PlannedShift[] {
    const dayStr = format(day, "yyyy-MM-dd");
    return shifts.filter((s) => s.shift_date === dayStr);
  }

  function navigate(dir: 1 | -1) {
    if (viewMode === "week") {
      setAnchor((d) => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
    } else {
      setAnchor((d) => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
    }
  }

  function openModalForDay(day: Date) {
    setDefaultDate(format(day, "yyyy-MM-dd"));
    setModalOpen(true);
  }

  const today = new Date();
  const totalShifts = shifts.length;
  const totalHours = shifts.reduce((sum, s) => {
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    return sum + (eh * 60 + em - sh * 60 - sm) / 60;
  }, 0);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Shift Schedule</h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalShifts} shift{totalShifts !== 1 ? "s" : ""} planned · {totalHours.toFixed(1)} hours
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("week")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors", viewMode === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Week
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l border-border", viewMode === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            >
              <CalendarRange className="h-3.5 w-3.5" /> Month
            </button>
          </div>
          <Button size="sm" onClick={() => { setDefaultDate(undefined); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Schedule Shift
          </Button>
        </div>
      </div>

      {/* Calendar nav */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold min-w-40 text-center">
          {viewMode === "week"
            ? `${format(rangeStart, "MMM d")} – ${format(rangeEnd, "MMM d, yyyy")}`
            : format(anchor, "MMMM yyyy")}
        </h2>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())} className="text-xs">
          Today
        </Button>
      </div>

      {/* Calendar grid */}
      {viewMode === "week" ? (
        // ── Week view: 7 vertical columns ──────────────────────────────────
        <div className="grid grid-cols-7 gap-1 min-h-[400px]">
          {days.map((day) => {
            const dayShifts = shiftsForDay(day);
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "rounded-lg border border-border flex flex-col min-h-[360px]",
                  isToday && "border-primary/40 bg-primary/5"
                )}
              >
                {/* Day header */}
                <div className={cn(
                  "px-2 py-1.5 border-b border-border flex flex-col items-center",
                  isToday && "border-primary/20"
                )}>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {format(day, "EEE")}
                  </span>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums",
                    isToday && "text-primary"
                  )}>
                    {format(day, "d")}
                  </span>
                  {dayShifts.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5">
                      {dayShifts.length}
                    </Badge>
                  )}
                </div>

                {/* Shifts */}
                <div className="flex-1 p-1 space-y-1 overflow-y-auto">
                  {isLoading ? (
                    <div className="h-8 bg-muted animate-pulse rounded" />
                  ) : (
                    dayShifts.map((s) => (
                      <ShiftChip
                        key={s.id}
                        shift={s}
                        workerName={workerMap[s.worker_id] ?? "Unknown"}
                        onDelete={doDelete}
                      />
                    ))
                  )}
                </div>

                {/* Add button */}
                <button
                  onClick={() => openModalForDay(day)}
                  className="w-full py-1 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors border-t border-border rounded-b-lg"
                >
                  + Add
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        // ── Month view: calendar grid ────────────────────────────────────────
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 bg-muted/30">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells — pad to start on Monday */}
          <div className="grid grid-cols-7">
            {/* Leading empty cells */}
            {Array.from({ length: (rangeStart.getDay() + 6) % 7 }).map((_, i) => (
              <div key={`pre-${i}`} className="border-t border-r border-border min-h-[90px] bg-muted/10" />
            ))}

            {days.map((day) => {
              const dayShifts = shiftsForDay(day);
              const isToday = isSameDay(day, today);
              const isWeekend = [0, 6].includes(day.getDay());
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-t border-r border-border min-h-[90px] p-1 flex flex-col",
                    isToday && "bg-primary/5",
                    isWeekend && "bg-muted/20"
                  )}
                >
                  <button
                    onClick={() => openModalForDay(day)}
                    className={cn(
                      "self-start text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors mb-1",
                      isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                  <div className="space-y-0.5 flex-1 overflow-hidden">
                    {isLoading ? null : dayShifts.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        className="group relative text-[10px] rounded bg-primary/10 text-primary px-1 py-0.5 truncate cursor-default"
                        title={`${workerMap[s.worker_id] ?? "?"} · ${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}`}
                      >
                        <span className="font-medium">{workerMap[s.worker_id]?.split(" ")[0] ?? "?"}</span>
                        {" "}{s.start_time.slice(0, 5)}
                        <button
                          className="absolute top-0 right-0 hidden group-hover:flex items-center justify-center h-full px-0.5 text-destructive"
                          onClick={(e) => { e.stopPropagation(); doDelete(s.id); }}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                    {dayShifts.length > 2 && (
                      <p className="text-[10px] text-muted-foreground pl-1">+{dayShifts.length - 2} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      {workers.length > 0 && shifts.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {workers.filter((w) => w.status === "active").map((w) => {
            const count = shifts.filter((s) => s.worker_id === w.id).length;
            if (count === 0) return null;
            return (
              <span key={w.id} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary inline-block" />
                {w.full_name} ({count})
              </span>
            );
          })}
        </div>
      )}

      <AddShiftModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        siteId={activeSiteId!}
        workers={workers}
        defaultDate={defaultDate}
      />
    </div>
  );
}
