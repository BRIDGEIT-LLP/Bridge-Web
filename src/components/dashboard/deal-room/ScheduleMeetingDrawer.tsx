"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { TimePicker } from "@/components/ui/TimePicker";
import { todayLocalDateStr, nowLocalTimeStr } from "@/lib/utils";
import { isValidMeetingLink, MEETING_LINK_ERROR } from "./meeting-link";

/** The scheduled meeting form values handed back on Confirm. */
export interface ScheduleMeetingFormValues {
  title: string;
  /** yyyy-mm-dd */
  date: string;
  /** HH:mm (24h) */
  time: string;
  duration: string;
  link: string;
  agenda: string;
}

/** Duration dropdown options. */
const DURATION_OPTIONS = [
  { value: "15m", label: "15 min" },
  { value: "30m", label: "30 min" },
  { value: "45m", label: "45 min" },
  { value: "60m", label: "1 hour" },
];

interface ScheduleMeetingDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Called on Confirm with the form values; the caller owns the actual API call. */
  onConfirm: (values: ScheduleMeetingFormValues) => Promise<void> | void;
}

/**
 * Right-side drawer to schedule a meeting in the deal room. Purely presentational —
 * collects title/date/time/duration/link/agenda and hands them to `onConfirm`, which
 * the caller (DealSidePanel) turns into the `POST /meetings` payload (adding
 * `dealRoomId` + `recipientUserId`, and combining date+time into an ISO `scheduledAt`).
 */
export function ScheduleMeetingDrawer({ open, onClose, onConfirm }: ScheduleMeetingDrawerProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("30m");
  const [link, setLink] = useState("");
  const [agenda, setAgenda] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const linkValid = isValidMeetingLink(link);
  const linkError = link.trim().length > 0 && !linkValid ? MEETING_LINK_ERROR : undefined;
  const canConfirm = title.trim().length > 0 && date.length > 0 && time.length > 0 && linkValid;
  const today = todayLocalDateStr();
  const minTime = date === today ? nowLocalTimeStr() : undefined;

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate);
    if (nextDate === today && time && time < nowLocalTimeStr()) setTime("");
  };

  const reset = () => {
    setTitle("");
    setDate("");
    setTime("");
    setDuration("30m");
    setLink("");
    setAgenda("");
  };

  const confirm = async () => {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm({
        title: title.trim(),
        date,
        time,
        duration,
        link: link.trim(),
        agenda: agenda.trim(),
      });
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const discard = () => {
    reset();
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Schedule Meeting"
      subtitle="New event"
      widthClass="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={discard}
            className="flex h-11 items-center rounded-xl border border-dashed border-outline-variant/60 px-5 font-bold max-sm:px-3 max-sm:text-sm text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm || submitting}
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-6 font-bold max-sm:px-3 max-sm:text-sm text-on-primary transition-colors hover:bg-primary-dim disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="event_available" size={18} />
            {submitting ? "Scheduling…" : "Confirm Meeting"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Meeting title */}
        <Input
          label="Title"
          required
          placeholder="e.g. Q4 Strategy Review"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Date" required type="date" min={today} value={date} onChange={(e) => handleDateChange(e.target.value)} />
          <TimePicker label="Time" required value={time} onChange={setTime} minTime={minTime} />
        </div>

        {/* Duration */}
        <Select label="Duration" required options={DURATION_OPTIONS} value={duration} onChange={setDuration} searchable={false} />

        {/* Meeting link */}
        <Input
          label="Link"
          required
          type="text"
          inputMode="url"
          placeholder="e.g. https://meet.google.com/abc-defg-hij"
          value={link}
          error={linkError}
          onChange={(e) => setLink(e.target.value)}
        />

        {/* Agenda */}
        <Textarea
          label="Agenda"
          rows={4}
          required
          placeholder="Outline the main objectives of this discussion…"
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
        />
      </div>
    </Drawer>
  );
}
