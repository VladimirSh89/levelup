---
name: High-Velocity Precision
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d0c5af'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#99907c'
  outline-variant: '#4d4635'
  surface-tint: '#e9c349'
  primary: '#f2ca50'
  on-primary: '#3c2f00'
  primary-container: '#d4af37'
  on-primary-container: '#554300'
  inverse-primary: '#735c00'
  secondary: '#ffb4a8'
  on-secondary: '#690000'
  secondary-container: '#ce0301'
  on-secondary-container: '#ffdcd7'
  tertiary: '#cfcece'
  on-tertiary: '#2f3131'
  tertiary-container: '#b3b3b3'
  on-tertiary-container: '#444546'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe088'
  primary-fixed-dim: '#e9c349'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#ffdad4'
  secondary-fixed-dim: '#ffb4a8'
  on-secondary-fixed: '#410000'
  on-secondary-fixed-variant: '#930000'
  tertiary-fixed: '#e3e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Oswald
    fontSize: 80px
    fontWeight: '700'
    lineHeight: 88px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Oswald
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Oswald
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: 0.02em
  headline-md:
    fontFamily: Oswald
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: 0.05em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  section-gap: 120px
---

## Brand & Style

This design system embodies a high-octane, masculine aesthetic characterized by precision, authority, and premium craft. Inspired by aviation and industrial excellence, the visual language is aggressive yet disciplined. 

The style utilizes a **Modern-Brutalist** hybrid: 
- **Dark & Moody:** A foundation of deep charcoal provides a canvas for high-contrast accents.
- **Industrial Precision:** Sharp edges, technical metadata, and "instrument panel" layouts.
- **Tactile Luxury:** Subtle metallic gradients and selective inner glows that mimic high-end machinery.
- **Urgency:** Intentional use of bold typography and vibrant "alert" colors to drive the booking experience.

The target audience seeks more than a haircut; they seek an elite service environment that feels both exclusive and powerful.

## Colors

The palette is designed for maximum impact and visual hierarchy in a low-light environment.

- **Primary (Gold/Amber):** Used for primary CTAs, active states, and premium highlights. It should feel metallic, often implemented with a subtle linear gradient.
- **Secondary (Urgent Red):** Reserved exclusively for high-conversion "Book Now" triggers and critical alerts. It represents the "Afterburner" effect.
- **Neutral (Charcoal):** The bedrock of the UI. Use `#0D0D0D` for the main background and `#1A1A1A` for surface containers to create depth.
- **Typography Colors:** Primary text is a warm off-white (#F5F5F5). Secondary text is a muted warm gray (#A8A8A8) to prevent visual clutter.

## Typography

Typography is a primary tool for establishing authority. 

- **Headlines:** All-caps **Oswald** is the standard. It provides a condensed, vertical rhythm that feels industrial and commanding. Use tight tracking for large displays and wider tracking for sub-headers.
- **Body:** **Hanken Grotesk** offers a clean, contemporary balance to the aggressive headlines, ensuring high readability for service menus and descriptions.
- **Technical/Metadata:** **JetBrains Mono** is used for labels, timestamps, and pricing to reinforce the "instrumentation" aesthetic. This monospaced font adds a layer of technical precision.

## Layout & Spacing

The layout follows a **Strict Grid** model to mirror military and industrial blueprints.

- **Grid:** Use a 12-column grid for desktop with wide 24px gutters. Elements should feel "locked" into place.
- **Density:** High-density information is acceptable in booking widgets, but marketing sections should utilize large vertical gaps (120px+) to allow the high-contrast visuals to breathe.
- **Responsive Behavior:** On mobile, margins shrink to 16px. Components like the booking widget transition from side-by-side steps to a vertical stack with a fixed-bottom "Next" action.

## Elevation & Depth

Depth is created through **Tonal Layering** and **Selective Illumination** rather than traditional soft shadows.

- **Surface Levels:** The background is the darkest layer. Cards and containers use a slightly lighter charcoal (#1A1A1A) with sharp, 1px borders in a muted gold or dark gray.
- **The "Glow":** Interactive elements use a `box-shadow` with a 15px-30px blur using the primary gold color at low opacity (20%) to simulate a backlit instrument or a polished metallic reflection.
- **Hard Edges:** Avoid soft, diffused elevations. Use high-contrast inner borders to define depth within containers.

## Shapes

The shape language is strictly **Sharp and Angular**. 

- **Corner Radius:** Elements use a 0px radius (Sharp) across all buttons, cards, and input fields to maintain an aggressive, industrial look.
- **Circular Exceptions:** Barber profiles and specific status indicators (like "Active" lights) are the only elements allowed to be circular, providing a necessary visual break and drawing focus to the "human" element of the service.
- **Angled Cuts:** For advanced UI components, use 45-degree clipped corners (dog-ears) on buttons or card headers to evoke aerospace design.

## Components

### Buttons
- **Primary:** Sharp-edged, background of Primary Gold, text in Black. On hover, apply a 2px inner border of a lighter gold and a subtle outer glow.
- **Booking (Urgent):** Secondary Red background. Use for "Confirm Appointment" only.
- **Ghost:** 1px Gold border with transparent background and Gold text.

### Service Cards
- Dark charcoal background (#1A1A1A).
- Top border of 2px Primary Gold.
- Price displayed in JetBrains Mono at the top right.
- Typography: Headline-md for service names.

### Booking Widget
- **Progress Indicator:** A horizontal bar using technical line-art. Completed steps are Gold, current is Red (blinking), future steps are Dark Gray.
- **Time Slots:** Square, sharp-edged buttons. Selected slot has a solid Gold background.

### Barber Profiles
- Circular imagery with a 2px Gold "ring" border.
- Name in Oswald (Headline-md) positioned beneath the circle.
- "Expertise" tags using the Label-caps style in a small, sharp-edged box.

### Input Fields
- Underline-only or 1px border.
- Active state: Border changes to Gold with a JetBrains Mono label floating above the field.