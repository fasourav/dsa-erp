"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  CALLING_CODES,
  callingCodeByValue,
  callingCodeMatches,
  parseStoredPhone,
  toE164,
  type CallingCode,
} from "@/lib/phone"

export function PhoneInput({
  id,
  defaultValue = "",
  onChange,
  disabled = false,
  invalid = false,
  placeholder = "1712-345678",
}: {
  id: string
  /** Stored phone: E.164 or a legacy local number. Read once, when the field mounts. */
  defaultValue?: string
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  placeholder?: string
}) {
  const initial = parseStoredPhone(defaultValue)
  const [callingCode, setCallingCode] = useState(initial.callingCode)
  const [national, setNational] = useState(initial.national)

  function emit(code: string, nextNational: string) {
    onChange(toE164(code, nextNational))
  }

  return (
    <InputGroup>
      <InputGroupAddon>
        <CallingCodePicker
          value={callingCode}
          disabled={disabled}
          onChange={(next) => {
            setCallingCode(next)
            emit(next, national)
          }}
        />
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        enterKeyHint="next"
        value={national}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value
          setNational(next)
          emit(callingCode, next)
        }}
      />
    </InputGroup>
  )
}

function CallingCodePicker({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled: boolean
  onChange: (code: string) => void
}) {
  const selected = callingCodeByValue(value)

  return (
    <Combobox
      items={CALLING_CODES}
      value={selected}
      disabled={disabled}
      filter={callingCodeMatches}
      isItemEqualToValue={(item, current) => item.value === current.value}
      onValueChange={(next) => {
        if (next) onChange(next.value)
      }}
    >
      <ComboboxTrigger
        disabled={disabled}
        aria-label="Country code"
        render={<Button type="button" variant="ghost" className="gap-1 font-semibold" />}
      >
        {selected.label}
      </ComboboxTrigger>
      <ComboboxContent className="min-w-64">
        <ComboboxInput
          aria-label="Search country codes"
          placeholder="Search"
          showTrigger={false}
          disabled={disabled}
        />
        <ComboboxEmpty>No matches</ComboboxEmpty>
        <ComboboxList>
          {(item: CallingCode) => (
            <ComboboxItem key={item.value} value={item}>
              {item.country} {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
