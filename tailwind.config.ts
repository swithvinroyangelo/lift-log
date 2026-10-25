// Maps tokens.css into Tailwind so components write `bg-surface text-muted`, never raw hex.
// Tailwind v3-style theme extension. Values live in tokens.css, so replica-brand only edits that file.
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        border: "var(--color-border)",
        "border-input": "var(--color-border-input)",
        text: "var(--color-text)",
        muted: "var(--color-text-muted)",
        accent: "var(--color-accent)",
        "on-accent": "var(--color-on-accent)",
        danger: "var(--color-danger)",
        success: "var(--color-success)",
        "on-success": "var(--color-on-success)",
        "success-surface": "var(--color-success-surface)",
        warmup: "var(--color-warmup)",
        scrim: "var(--color-scrim)",
        sheet: "var(--color-sheet)",
        warning: "var(--color-warning)",
        record: "var(--color-record)",
        streak: "var(--color-streak)",
      },
      fontFamily: { sans: "var(--font-sans)", mono: "var(--font-mono)" },
      fontSize: {
        "2xs": ["var(--text-2xs)", { lineHeight: "var(--leading-2xs)", fontWeight: "500" }],
        xs: ["var(--text-xs)", { lineHeight: "var(--leading-xs)" }],
        sm: ["var(--text-sm)", { lineHeight: "var(--leading-sm)" }],
        base: ["var(--text-base)", { lineHeight: "var(--leading-base)", fontWeight: "600" }],
        lg: ["var(--text-lg)", { lineHeight: "var(--leading-lg)", fontWeight: "700" }],
        xl: ["var(--text-xl)", { lineHeight: "var(--leading-xl)", fontWeight: "700" }],
      },
      spacing: {
        margin: "var(--screen-margin)",
        card: "var(--card-padding)",
        "card-gap": "var(--card-gap)",
        control: "var(--control-height)",
        button: "var(--button-height)",
        "tab-bar": "var(--tab-bar-height)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      transitionDuration: { fast: "var(--motion-fast)", base: "var(--motion-base)" },
      transitionTimingFunction: { DEFAULT: "var(--motion-ease)" },
    },
  },
  plugins: [],
};

export default config;
