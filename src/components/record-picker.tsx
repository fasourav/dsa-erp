"use client"

import { useMemo } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { cn } from "@/lib/utils"

export type PickerOption = {
  value: string
  label: string
  hint?: string
}

const CLEAR_VALUE = "__record_picker_clear__"

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function optionMatches(item: PickerOption, query: string): boolean {
  const q = normalizeSearchText(query.trim())
  if (!q) return true
  if (normalizeSearchText(item.label).includes(q)) return true
  if (item.hint && normalizeSearchText(item.hint).includes(q)) return true
  return false
}

export function RecordPicker({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder = "Search",
  emptyText = "No matches",
  disabled = false,
  invalid = false,
  allowClear = false,
  clearLabel = "None",
  fallbackLabel = "Saved record",
}: {
  id: string
  value: string
  onValueChange: (value: string) => void
  options: readonly PickerOption[]
  placeholder: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  invalid?: boolean
  allowClear?: boolean
  clearLabel?: string
  fallbackLabel?: string
}) {
  const resolvedOptions = useMemo(() => {
    const list: PickerOption[] = []
    if (allowClear) {
      list.push({ value: CLEAR_VALUE, label: clearLabel })
    }
    for (const option of options) {
      list.push(option)
    }
    if (value && !options.some((option) => option.value === value)) {
      list.push({ value, label: fallbackLabel })
    }
    return list
  }, [allowClear, clearLabel, fallbackLabel, options, value])

  const selectedOption = useMemo(() => {
    if (!value) return null
    return resolvedOptions.find((option) => option.value === value) ?? null
  }, [resolvedOptions, value])

  return (
    <Combobox
      items={resolvedOptions}
      value={selectedOption}
      disabled={disabled}
      filter={optionMatches}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      onValueChange={(next) => {
        if (!next || next.value === CLEAR_VALUE) {
          onValueChange("")
          return
        }
        onValueChange(next.value)
      }}
    >
      {/* Popup is portalled at z-50 above Base UI dialogs/sheets; Escape closes only the popup first. */}
      <ComboboxTrigger
        id={id}
        type="button"
        disabled={disabled}
        data-size="default"
        data-placeholder={!selectedOption ? "" : undefined}
        aria-invalid={invalid || undefined}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-control border-0 bg-field py-2 pr-3 pl-3.5 text-base whitespace-nowrap text-foreground transition-[box-shadow,background-color] outline-none select-none focus-visible:shadow-field-focus disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive),0_0_0_4px_var(--destructive-tint)] data-placeholder:text-subtle-foreground data-[size=default]:h-11 data-[size=sm]:h-9.5 md:bg-control md:text-sm md:shadow-field md:focus-visible:shadow-field-focus md:data-[size=default]:h-10.5 md:data-[size=sm]:h-8 in-data-[field-layout=inset]:w-full in-data-[field-layout=inset]:rounded-none in-data-[field-layout=inset]:bg-transparent in-data-[field-layout=inset]:px-0 in-data-[field-layout=inset]:shadow-none in-data-[field-layout=inset]:focus-visible:shadow-none in-data-[field-layout=inset]:data-[size=default]:h-7 md:in-data-[field-layout=inset]:rounded-control md:in-data-[field-layout=inset]:bg-control md:in-data-[field-layout=inset]:pr-3 md:in-data-[field-layout=inset]:pl-3.5 md:in-data-[field-layout=inset]:shadow-field md:in-data-[field-layout=inset]:focus-visible:shadow-field-focus md:in-data-[field-layout=inset]:data-[size=default]:h-10.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            !selectedOption && "text-subtle-foreground",
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
      </ComboboxTrigger>
      <ComboboxContent align="start">
        <ComboboxInput
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          autoComplete="off"
          enterKeyHint="search"
          showTrigger={false}
          disabled={disabled}
        />
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item: PickerOption) => (
            <ComboboxItem
              key={item.value}
              value={item}
              className={cn(
                item.value === CLEAR_VALUE && "text-muted-foreground",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{item.label}</span>
                {item.hint ? (
                  <span className="truncate text-caption text-muted-foreground">
                    {item.hint}
                  </span>
                ) : null}
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
