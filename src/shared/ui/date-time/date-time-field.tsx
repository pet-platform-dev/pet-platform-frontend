import { DatePicker } from "./date-picker";
import { TimePicker } from "./time-picker";
export function DateTimeField({
  date,
  time,
  onDate,
  onTime,
  dateLabel = "Дата",
  timeLabel = "Час",
  disabled = false,
}: {
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
  dateLabel?: string;
  timeLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="care-date-time">
      <DatePicker
        label={dateLabel}
        value={date}
        onChange={onDate}
        disabled={disabled}
      />
      <TimePicker
        label={timeLabel}
        value={time}
        onChange={onTime}
        disabled={disabled}
      />
    </div>
  );
}
