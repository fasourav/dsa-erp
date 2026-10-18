// Shared by every form inside the AuthStage glass card. Uses standard Atrium
// field tokens so light, dark, and system modes all render with proper contrast.
export const authGroupClassName =
  "bg-field text-foreground shadow-field md:bg-control md:shadow-field has-[[data-slot=input-group-control]:focus-visible]:shadow-field-focus md:has-[[data-slot=input-group-control]:focus-visible]:shadow-field-focus"
export const authInputClassName =
  "text-base text-foreground placeholder:text-muted-foreground md:text-sm"
export const authLabelClassName = "text-foreground"
export const authIconClassName = "text-muted-foreground"
export const authAlertClassName =
  "rounded-2xl bg-destructive-tint px-3.5 py-2.5 text-sm text-destructive"
export const authSubmitClassName = "mt-1 w-full"
