// Shared by every form on the AuthStage card. On the desktop sphere the card
// is clear glass, so fields, labels, and the submit button switch to the
// translucent white treatment from the mockup; phones keep the grouped list.
export const authGroupClassName =
  "md:in-data-[field-layout=inset]:bg-login-field md:in-data-[field-layout=inset]:text-login-ink md:in-data-[field-layout=inset]:shadow-login-field md:in-data-[field-layout=inset]:has-[[data-slot=input-group-control]:focus-visible]:shadow-login-field-focus"
export const authInputClassName =
  "text-base md:text-sm md:text-login-ink md:placeholder:text-login-ink-muted"
export const authLabelClassName = "md:in-data-[field-layout=inset]:text-login-ink"
export const authIconClassName = "hidden md:flex md:text-login-field-icon"
export const authAlertClassName =
  "mt-3 rounded-2xl bg-destructive-tint px-3.5 py-2.5 text-sm text-destructive md:bg-login-button"
export const authSubmitClassName =
  "mt-4 h-13.5 w-full text-[1.03125rem] font-strong md:mt-5.5 md:h-12 md:bg-login-button md:text-callout md:font-semibold md:text-login-button-ink md:shadow-login-button md:hover:bg-login-button/90"
