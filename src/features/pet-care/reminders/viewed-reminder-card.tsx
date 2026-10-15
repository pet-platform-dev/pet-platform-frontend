"use client";
import type { ComponentProps } from "react";
import { useViewedReminder } from "@/features/notifications/use-viewed-reminder";
import { ReminderCard } from "./reminder-card";
export function ViewedReminderCard(props: ComponentProps<typeof ReminderCard>) {
  const ref = useViewedReminder(props.reminder.petId, props.reminder.id, true);
  return <ReminderCard {...props} viewRef={ref} />;
}
