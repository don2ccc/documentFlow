---
name: Efficient Enterprise Logic
colors:
  surface: '#faf9f9'
  surface-dim: '#dbdad9'
  surface-bright: '#faf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e8'
  surface-container-highest: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#414755'
  inverse-surface: '#2f3031'
  inverse-on-surface: '#f2f0f0'
  outline: '#727786'
  outline-variant: '#c1c6d7'
  surface-tint: '#0059c7'
  primary: '#0057c2'
  on-primary: '#ffffff'
  primary-container: '#006ef2'
  on-primary-container: '#fefcff'
  inverse-primary: '#afc6ff'
  secondary: '#266d00'
  on-secondary: '#ffffff'
  secondary-container: '#85fa51'
  on-secondary-container: '#287100'
  tertiary: '#b71423'
  on-tertiary: '#ffffff'
  tertiary-container: '#db3239'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#afc6ff'
  on-primary-fixed: '#001a43'
  on-primary-fixed-variant: '#004398'
  secondary-fixed: '#88fd54'
  secondary-fixed-dim: '#6de039'
  on-secondary-fixed: '#062100'
  on-secondary-fixed-variant: '#1a5200'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ae'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#930016'
  background: '#faf9f9'
  on-background: '#1b1c1c'
  surface-variant: '#e3e2e2'
typography:
  display-lg:
    fontFamily: Inter, system-ui
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
  headline-md:
    fontFamily: Inter, system-ui
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter, system-ui
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter, system-ui
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter, system-ui
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-md:
    fontFamily: Inter, system-ui
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter, system-ui
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
  headline-sm-mobile:
    fontFamily: Inter, system-ui
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-page: 24px
---

## Brand & Style

The design system is engineered for internal operational efficiency, focusing on a **Corporate / Modern** aesthetic that prioritizes clarity, speed of cognition, and data density. The brand personality is professional, reliable, and unobtrusive, ensuring that the interface stays out of the user's way during complex workflows.

The visual direction follows a **refined flat** approach. It avoids unnecessary decorative elements, utilizing generous whitespace (negative space) to define content boundaries rather than heavy lines. The emotional response should be one of "controlled focus"—reducing cognitive load through systematic alignment and a disciplined color application.

## Colors

The palette is anchored by a high-performance **Enterprise Blue** (#1677ff), used strategically for primary actions, active states, and focus indicators. 

- **Primary**: #1677ff (Actionable items and primary branding)
- **Success**: #52c41a (Approved states, positive completion)
- **Warning**: #faad14 (Pending review, cautionary data)
- **Error**: #ff4d4f (Rejected states, destructive actions)
- **Neutral**: A calculated scale of grays from `#262626` (Titles) to `#f5f5f5` (Backgrounds), ensuring accessible contrast ratios for long-duration usage.

Surface colors utilize pure white (`#ffffff`) for cards and containers to maximize the "clean" feel, with light gray borders (`#f0f0f0`) providing subtle structure.

## Typography

This design system utilizes a **system-agnostic sans-serif stack** (Inter, followed by system default fonts) to ensure maximum legibility and performance across Windows (Microsoft YaHei) and macOS (PingFang SC) environments.

The scale is optimized for **reading density**. The base body size is set to 14px, which is the enterprise standard for data-heavy applications. Weights are restricted to Regular (400), Medium (500), and Semi-Bold (600) to maintain a clean hierarchy without visual clutter. For numerical data in tables, use tabular lining figures to ensure vertical alignment.

## Layout & Spacing

The layout is built on a **4px baseline grid** and a **12-column fluid grid system**. 

- **Sidebar Navigation**: Fixed width at 240px (expanded) or 64px (collapsed).
- **Page Content**: 24px internal padding for standard containers.
- **Data Tables**: Use "Comfortable" (16px vertical padding) or "Compact" (8px vertical padding) modes depending on data volume.
- **Breakpoints**: 
  - Mobile: < 768px (Sidebars become overlays)
  - Tablet: 768px - 1200px
  - Desktop: > 1200px (Fixed max-width for content at 1440px to prevent excessive line lengths).

## Elevation & Depth

To maintain a flat, professional aesthetic, this design system minimizes the use of shadows. Depth is communicated through **Tonal Layers**:

1.  **Level 0 (Background)**: `#f5f5f5` - The lowest layer.
2.  **Level 1 (Cards/Content)**: `#ffffff` - Used for the main workspace and cards. A 1px border of `#f0f0f0` replaces shadows.
3.  **Level 2 (Dropdowns/Modals)**: White with a very soft, diffused ambient shadow (`0 6px 16px rgba(0, 0, 0, 0.08)`) to indicate temporary positioning above the workspace.

Interactions (hover) should use background color shifts (e.g., `#f5f5f5` hover state on a white list item) rather than lift effects.

## Shapes

The shape language is **Soft**. A consistent 4px (`0.25rem`) corner radius is applied to buttons, input fields, and cards. This provides a modern, approachable feel while maintaining the structural rigour of a professional tool. Status tags and chips use a 2px radius or remain slightly more rectangular to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary**: Blue background, white text. No gradient.
- **Secondary**: White background, gray-border (#d9d9d9), blue text on hover.
- **Ghost**: No background/border, used for low-priority actions in toolbars.

### Status Labels (Tags)
Status labels use a "Soft Fill" approach:
- **Pending (待审批)**: #faad14 background at 10% opacity, #faad14 text.
- **Approved (已通过)**: #52c41a background at 10% opacity, #52c41a text.
- **Rejected (已驳回)**: #ff4d4f background at 10% opacity, #ff4d4f text.

### Data Tables
Tables are the core of the system. Use a solid `#fafafa` header background. Row dividers are `1px solid #f0f0f0`. Text within cells should be vertically centered. Active/Selected rows use a subtle blue tint (`#e6f7ff`).

### Form Fields
Inputs use a `1px solid #d9d9d9` border. On focus, the border transitions to Primary Blue with a subtle 2px blue glow (ring). Labels are placed above the input for better readability in complex forms.

### Navigation
The sidebar uses a dark theme (`#001529`) or a clean white theme. High-contrast white text is used for active states in dark mode, or Primary Blue for active states in light mode.