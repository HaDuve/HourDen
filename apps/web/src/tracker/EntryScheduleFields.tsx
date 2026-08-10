import Calendar from "lucide-react/icons/calendar";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { inputClass } from "../layout/ui-classes.js";

export type EntryScheduleValue = {
  date: string;
  startTime: string;
  endTime: string;
};

type EntryScheduleFieldsProps = {
  value: EntryScheduleValue;
  onChange: (value: EntryScheduleValue) => void;
  required?: boolean;
  disabled?: boolean;
};

const CALENDAR_ICON_SIZE = 16;
const CALENDAR_ICON_STROKE = 1.75;
const TIME_PLACEHOLDER = "hh:mm";

type ScheduleTimeInputProps = {
  label: string;
  value: string;
  required: boolean;
  disabled: boolean;
  onChange: (time: string) => void;
};

/** Empty time fields use text + placeholder so browsers show hh:mm instead of --:--. */
function ScheduleTimeInput({
  label,
  value,
  required,
  disabled,
  onChange,
}: ScheduleTimeInputProps) {
  const [focused, setFocused] = useState(false);
  const showPicker = value !== "" || focused;

  return (
    <label className="grid min-w-[7rem] flex-1 gap-1 text-sm text-content">
      <span>{label}</span>
      <input
        required={required}
        disabled={disabled}
        aria-label={label}
        type={showPicker ? "time" : "text"}
        placeholder={TIME_PLACEHOLDER}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </label>
  );
}

export function EntryScheduleFields({
  value,
  onChange,
  required = false,
  disabled = false,
}: EntryScheduleFieldsProps) {
  const { t } = useTranslation();
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <ScheduleTimeInput
          label={t("tracker.start")}
          value={value.startTime}
          required={required}
          disabled={disabled}
          onChange={(startTime) => onChange({ ...value, startTime })}
        />

        <ScheduleTimeInput
          label={t("tracker.end")}
          value={value.endTime}
          required={required}
          disabled={disabled}
          onChange={(endTime) => onChange({ ...value, endTime })}
        />

        {dateOpen ? (
          <label className="grid min-w-[9rem] gap-1 text-sm text-content">
            <span>{t("tracker.date")}</span>
            <input
              required={required}
              disabled={disabled}
              aria-label={t("tracker.date")}
              type="date"
              value={value.date}
              onChange={(event) =>
                onChange({ ...value, date: event.target.value })
              }
              onBlur={() => setDateOpen(false)}
              autoFocus
              className={inputClass}
            />
          </label>
        ) : (
          <button
            type="button"
            aria-label={`${t("tracker.changeDate")}: ${value.date}`}
            title={value.date}
            disabled={disabled}
            onClick={() => setDateOpen(true)}
            className="inline-flex h-10 items-center justify-center px-2 text-muted hover:text-content disabled:opacity-50"
          >
            <Calendar
              size={CALENDAR_ICON_SIZE}
              strokeWidth={CALENDAR_ICON_STROKE}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </div>
  );
}
