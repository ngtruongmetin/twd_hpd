---
version: alpha
name: VoiceBox-VN
description: |
  A Vietnamese-first editorial design system inspired by modern magazine layouts, brutal contrast, and bold cultural commentary platforms. VoiceBox VN combines oversized typography, minimal monochrome surfaces, and a sharp red accent system optimized specifically for Vietnamese readability. The system prioritizes clean typography, generous whitespace, strong hierarchy, and comfortable long-form reading across landing pages, blogs, product showcases, and editorial interfaces.

colors:
  primary: "#0A0A0A"
  primary-hover: "#171717"
  secondary: "#EF4444"
  secondary-hover: "#DC2626"
  secondary-active: "#B91C1C"

  background: "#FAFAFA"
  surface: "#F5F5F5"
  surface-raised: "#EAEAEA"

  text-primary: "#111111"
  text-secondary: "#525252"
  text-tertiary: "#A3A3A3"

  border: "#D4D4D4"
  border-strong: "#0A0A0A"

  success: "#16A34A"
  warning: "#CA8A04"
  error: "#EF4444"

  focus-ring-inner: "#FAFAFA"
  focus-ring-outer: "#0A0A0A"

typography:
  display-xl:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 72px
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: -0.04em

  display-lg:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 56px
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: -0.02em

  heading-xl:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 42px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.01em

  heading-lg:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em

  heading-md:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0

  body-lg:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.85
    letterSpacing: 0

  body-md:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.8
    letterSpacing: 0

  body-strong:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.7
    letterSpacing: 0

  body-sm:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0

  caption:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: 0.01em

  overline:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0.08em

  button:
    fontFamily: "'Be Vietnam Pro', Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0

  mono:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0

rounded:
  none: 0px
  sm: 6px
  md: 12px
  lg: 20px
  full: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    border: "2px solid #0A0A0A"
    height: 48px

  button-primary-hover:
    backgroundColor: "{colors.secondary}"
    textColor: "#FFFFFF"

  button-primary-active:
    backgroundColor: "{colors.secondary-active}"
    textColor: "#FFFFFF"

  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 12px 24px
    border: "2px solid #0A0A0A"
    height: 48px

  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 12px 24px

  card-default:
    backgroundColor: "{colors.background}"
    border: "1px solid #E5E5E5"
    rounded: "{rounded.lg}"
    padding: 24px

  card-editorial:
    backgroundColor: "{colors.background}"
    borderTop: "4px solid #EF4444"
    borderLeft: "1px solid #E5E5E5"
    borderRight: "1px solid #E5E5E5"
    borderBottom: "1px solid #E5E5E5"
    rounded: "{rounded.lg}"
    padding: 32px

  text-input:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    border: "2px solid #D4D4D4"
    padding: 0 16px
    height: 48px

  text-input-focused:
    border: "2px solid #0A0A0A"
    ring: "0 0 0 2px #FAFAFA, 0 0 0 4px #0A0A0A"

  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 6px 14px

  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"

layout:
  maxWidth: 1200px
  contentWidth: 72ch
  heroWidth: 1100px

  spacing:
    desktop: 96px
    tablet: 72px
    mobile: 48px

  gutters:
    desktop: 32px
    tablet: 24px
    mobile: 16px

responsive:
  ultrawide: 1920px
  desktop: 1280px
  tablet: 768px
  mobile: 480px
  mobile-small: 320px

rules:
  typography:
    do:
      - Use Be Vietnam Pro for all Vietnamese UI text
      - Keep paragraph line-height >= 1.7
      - Keep headlines short and impactful
      - Use whitespace aggressively
      - Use sentence-case typography
      - Prioritize readability over visual extremeness

    dont:
      - Do not use ultra-condensed display fonts
      - Do not use font weight 900 for Vietnamese headlines
      - Do not use excessive negative letter spacing
      - Do not use long uppercase Vietnamese paragraphs
      - Do not use decorative serif fonts for body content
      - Do not reduce body text below 16px

  visual:
    do:
      - Use strong black-white contrast
      - Use red as a rare emotional accent
      - Use borders instead of shadows
      - Keep layouts spacious and breathable
      - Use typography as the primary visual hierarchy

    dont:
      - Do not use glassmorphism
      - Do not use neumorphism
      - Do not use colorful gradients
      - Do not overload the viewport
      - Do not use more than 2 accent colors

accessibility:
  minimumContrast: "WCAG AA"
  minimumTouchTarget: 44px
  minimumBodySize: 16px
  visibleFocusStates: true

recommended-stack:
  frontend:
    - Next.js
    - React
    - TailwindCSS
    - Framer Motion

  fonts:
    - Be Vietnam Pro
    - Inter
    - JetBrains Mono

  icons:
    - Lucide Icons

tailwind:
  fontFamily:
    sans:
      - Be Vietnam Pro
      - sans-serif

    mono:
      - JetBrains Mono
      - monospace