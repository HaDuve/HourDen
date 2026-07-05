import type { DescriptionSuggestion } from "@hourden/domain";
import { useEffect, useId, useRef, useState } from "react";
import { inputClass } from "./layout/ui-classes.js";
import { useDebouncedValue } from "./useDebouncedValue.js";

const SUGGESTION_DEBOUNCE_MS = 300;

type DescriptionAutocompleteProps = {
  label: string;
  value: string;
  required?: boolean;
  onChange: (description: string) => void;
  onSuggestionSelect: (suggestion: DescriptionSuggestion) => void;
  inputClassName?: string;
};

async function fetchDescriptionSuggestions(
  query: string,
): Promise<DescriptionSuggestion[]> {
  const res = await fetch(
    `/api/time-entries/suggestions?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to load suggestions (${res.status})`);
  }
  const data = (await res.json()) as { suggestions: DescriptionSuggestion[] };
  return data.suggestions;
}

export function DescriptionAutocomplete({
  label,
  value,
  required = false,
  onChange,
  onSuggestionSelect,
  inputClassName = inputClass,
}: DescriptionAutocompleteProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedValue = useDebouncedValue(value, SUGGESTION_DEBOUNCE_MS);
  const [suggestions, setSuggestions] = useState<DescriptionSuggestion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const trimmed = debouncedValue.trim();
    if (!trimmed) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    void fetchDescriptionSuggestions(trimmed)
      .then((loaded) => {
        if (!cancelled) {
          setSuggestions(loaded);
          setOpen(loaded.length > 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
          setOpen(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedValue]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const handleSelect = (suggestion: DescriptionSuggestion) => {
    onChange(suggestion.description);
    onSuggestionSelect(suggestion);
    setOpen(false);
  };

  return (
    <label className="grid gap-1 text-sm">
      <span>{label}</span>
      <div ref={containerRef} className="relative">
        <input
          required={required}
          aria-autocomplete="list"
          aria-controls={open ? listboxId : undefined}
          aria-expanded={open}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            if (event.target.value.trim()) {
              setOpen(true);
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setOpen(true);
            }
          }}
          className={`w-full ${inputClassName}`}
        />
        {open && suggestions.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-divider bg-surface py-1 shadow-lg"
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.description} role="presentation">
                <button
                  type="button"
                  role="option"
                  className="block w-full px-3 py-2 text-left text-sm text-content hover:bg-surface-hover"
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => handleSelect(suggestion)}
                >
                  {suggestion.description}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}
