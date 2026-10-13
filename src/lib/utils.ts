import { createCn } from "cn/config"

// Atrium's named @theme scales from globals.css. Without them the merger reads
// `text-ui` as a color and drops it next to `text-muted-foreground`, and treats
// `rounded-card` or `shadow-glass` as unknown. Add new scale names here too.
export const cn = createCn({
  extend: {
    theme: {
      text: [
        "large-title",
        "page-title",
        "dialog-title",
        "section",
        "panel-title",
        "kpi",
        "stat",
        "metric",
        "row",
        "callout",
        "ui",
        "label",
        "caption",
        "micro",
        "tab",
      ],
      "font-weight": ["book", "label", "strong"],
      radius: ["control", "tile", "card", "group", "sidebar", "dialog", "alert", "hero", "sheet"],
      shadow: [
        "glass",
        "float",
        "chrome",
        "control",
        "primary",
        "destructive",
        "segment",
        "field",
        "field-focus",
        "knob",
        "login-card",
        "login-field",
        "login-field-focus",
        "login-button",
        "login-sphere",
      ],
      blur: ["glass", "chrome", "float"],
    },
  },
})
