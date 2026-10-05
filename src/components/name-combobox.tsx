"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

export function NameCombobox({
  id,
  value,
  onValueChange,
  names,
  disabled,
  placeholder,
  invalid,
}: {
  id: string
  value: string
  onValueChange: (value: string) => void
  names: readonly string[]
  disabled?: boolean
  placeholder?: string
  invalid?: boolean
}) {
  function handleInput(
    next: string,
    details: { reason: string; cancel: () => void },
  ) {
    if (details.reason === "input-change" || details.reason === "item-press") {
      onValueChange(next)
      return
    }

    // Closing the list snaps unmatched text back to the last picked item.
    // These fields may be new text, so keep what was typed.
    details.cancel()
  }

  return (
    <Combobox
      autoComplete="off"
      items={names}
      inputValue={value}
      onInputValueChange={handleInput}
      onValueChange={(next) => {
        if (typeof next === "string") {
          onValueChange(next)
        }
      }}
    >
      <ComboboxInput
        id={id}
        className="w-full"
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
      />
      <ComboboxContent className="data-empty:hidden">
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
