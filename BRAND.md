# OpenGather Brand Model

## Purpose

OpenGather is not a fixed visual brand in the way a centrally controlled SaaS product is.
It is community software. That means the software should ship with a solid default look, but its appearance must be modifiable by the communities that run it.

The OpenGather brand goal is not strict visual uniformity across all deployments.
The goal is a stable, accessible, extensible design system that communities can adapt without breaking the product.

In short:

- OpenGather should feel coherent by default.
- OpenGather should be easy to restyle by changing tokens, not rewriting every component.
- Community operators should be able to make OpenGather feel like their own space.

## Brand Position

OpenGather is the community-owned surface.
It should communicate:

- autonomy
- warmth
- clarity
- trust
- adaptability

It should not depend on one exact palette, one exact font pairing, or one fixed marketing identity.
Those can change between communities.

## The Brand System Is Token-First

In OpenGather, brand customization should happen primarily through design tokens.
That means the stable contract is not "all buttons are this exact green."
The stable contract is "all buttons derive from semantic tokens that can be changed safely."

Current implementation starting points:

- `app/tailwind.css`
- `tailwind.config.ts`

These files define the initial token model with CSS custom properties for semantic roles such as:

- `--background`
- `--foreground`
- `--primary`
- `--secondary`
- `--muted`
- `--accent`
- `--destructive`
- `--border`
- `--input`
- `--ring`
- `--radius`

This is the correct direction and should be expanded rather than bypassed.

## Token Layers

OpenGather should use layered tokens:

### 1. Foundation tokens

These define raw values such as:

- color values
- type scale
- spacing scale
- radius scale
- shadow scale
- motion durations

### 2. Semantic tokens

These define UI meaning rather than specific appearance, for example:

- background
- surface
- surface-muted
- text
- text-muted
- primary
- primary-foreground
- accent
- border
- focus-ring
- success
- warning
- danger

Components should consume semantic tokens, not raw palette values.

### 3. Component tokens

If needed, components can expose local tokens such as:

- button-primary-bg
- card-border
- nav-active-bg

But these should still resolve back to semantic tokens where possible.

## Rules For Implementation

1. New UI work should prefer semantic CSS variables and tokenized Tailwind mappings over hard-coded colors.
2. Components should not embed one-off brand colors unless there is a clear product reason.
3. The default theme should remain calm, readable, and broadly useful for many types of communities.
4. Customization should be possible without editing component logic.
5. Theme changes must preserve accessibility, especially text contrast, focus states, and destructive-state clarity.
6. Community customization may change tone and personality, but should not reduce usability or trust.

## What Must Stay Stable

Even though OpenGather is modifiable, some qualities should remain consistent:

- it should feel trustworthy rather than promotional
- it should remain readable and accessible
- it should support long-term community use, not trend-driven novelty
- it should avoid manipulative attention design
- it should preserve clear distinction between normal, muted, active, and destructive actions

## What Communities Should Be Able To Change

Communities should be able to customize:

- color palette
- typography
- corner radius
- spacing density
- surface styles
- illustration and imagery style
- light and dark theme preferences
- community-specific accents and identity details

Prefer enabling this through tokens, theme presets, or documented override points.

## What We Should Avoid

- hard-coding colors directly into route components
- treating the default OpenGather theme as sacred or unchangeable
- building components that only work with one palette
- mixing product logic with theme logic
- shipping visual choices that prevent operators from making the product their own

## Governance

OpenGather should accept design evolution from the community more readily than the hub.
That means proposals around tokens, theme presets, and component flexibility are desirable.

When introducing new UI primitives, ask:

1. Does this expose a reusable semantic token?
2. Can a community restyle this without rewriting the component?
3. Does this preserve accessibility under different themes?

If the answer is no, the design is too rigid for OpenGather.

## Summary

OpenGather should be recognizable as OpenGather because of its values and product structure, not because every deployment looks identical.
Its brand system should be a durable token framework that communities can shape to fit their own identity.
