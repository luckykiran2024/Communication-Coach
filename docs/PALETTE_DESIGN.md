# Communication Coach appearance

The reference image suggests a calm, premium learning space: dark charcoal, green light and restrained gradients.
Emerald Studio adapts that direction for Communication Coach. The screen uses clear cards and legible type rather than
placing text directly over strong colour effects.

| Palette | Light | Dark | Character |
| --- | --- | --- | --- |
| Emerald Studio | Pale sage, deep-green actions | Charcoal, forest panels, mint actions | Recommended; closest to the reference |
| Sunrise Energy | Ivory and warm coral | Navy and coral | Expressive |
| Ocean Clarity | Ice and teal | Deep blue and aqua | Crisp |
| Berry Focus | Light plum and berry | Dark plum and orchid | Reflective |

Settings → Explore colour palettes opens the live preview. Light and Dark remain manual preferences; System is absent.
Each option changes the full app colour set. Saved palettes remain selected after an update, so an existing user's
Sunrise choice is preserved. New installs start with Emerald Studio in Light mode.

The tintable, bundled gradient mask is 1,164 bytes. Every palette provides explicit button foreground and error colours;
automated tests require at least 4.5:1 for text and 3:1 for form/control outlines. Scores and coaching content are not
colour-coded or changed by this visual update.

Local screenshots: `artifacts/emerald-light.png` and `artifacts/emerald-dark.png` (ignored build evidence).
Physical Android/iOS colour, font-scale and accessibility inspection remains a release check.

## Springbok identity

The original springbok mascot uses forest green and warm ivory to complement Emerald Studio without changing the
Communication Coach product name. The source mark is `apps/mobile/assets/springbok-mark.png`; the opaque square
launcher and web icon is `apps/mobile/assets/springbok-app-icon.png`. Android uses the smaller, transparent
`apps/mobile/assets/springbok-adaptive-foreground-v2.png` over a deep-green background to protect the horns from
adaptive icon masks. The earlier, larger foreground is retained as an alternate asset, not used in the build.

The welcome screen gives the logo a gentle upward hop every few seconds; the home-screen fallback identity hops once
on entry. The motion stops entirely when the system or app reduced-motion preference is active. Launcher icons remain static;
the new native icon requires a fresh Android/iOS build and device inspection before release.
