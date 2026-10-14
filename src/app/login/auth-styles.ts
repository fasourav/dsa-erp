// Shared by every form that sits inside the AuthStage orb. Each field is one
// rounded control: icon, input, and the password eye stay inside InputGroup.
export const authGroupClassName =
  "bg-login-field text-login-ink shadow-login-field md:bg-login-field md:shadow-login-field has-[[data-slot=input-group-control]:focus-visible]:shadow-login-field-focus md:has-[[data-slot=input-group-control]:focus-visible]:shadow-login-field-focus"
export const authInputClassName =
  "text-base text-login-ink placeholder:text-login-ink-muted md:text-sm"
export const authLabelClassName = "text-login-ink"
export const authIconClassName = "text-login-field-icon"
export const authAlertClassName =
  "rounded-2xl bg-destructive-tint px-3.5 py-2.5 text-sm text-destructive"
export const authSubmitClassName = "w-full"
