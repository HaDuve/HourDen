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
};

const CALENDAR_ICON_SIZE = 16;
const CALENDAR_ICON_STROKE = 1.75;

export function EntryScheduleFields({
  value,
  onChange,
  required = false,
}: EntryScheduleFieldsProps) {
  const { t } = useTranslation();
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-[7rem] flex-1 gap-1 text-sm text-content">
          <span>{t("tracker.start")}</span>
          <input
            required={required}
            aria-label={t("tracker.start")}
            type="time"
            value={value.startTime}
            onChange={(event) =>
              onChange({ ...value, startTime: event.target.value })
            }
            className={inputClass}
          />
        </label>

        <label className="grid min-w-[7rem] flex-1 gap-1 text-sm text-content">
          <span>{t("tracker.end")}</span>
          <input
            required={required}
            aria-label={t("tracker.end")}
            type="time"
            value={value.endTime}
            onChange={(event) =>
              onChange({ ...value, endTime: event.target.value })
            }
            className={inputClass}
          />
        </label>

        {dateOpen ? (
          <label className="grid min-w-[9rem] gap-1 text-sm text-content">
            <span>{t("tracker.date")}</span>
            <input
              required={required}
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
            onClick={() => setDateOpen(true)}
            className="inline-flex h-10 items-center justify-center px-2 text-muted hover:text-content"
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
