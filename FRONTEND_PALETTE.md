# SPARK Frontend Colour Palette

SPARK uses a dark charcoal interface with muted sage as its primary accent. The shared tokens are defined in [`app/globals.css`](app/globals.css) and exposed through Tailwind in [`tailwind.config.js`](tailwind.config.js).

## Core UI

| Role | Colour |
|---|---|
| Background | `#141515` |
| Surface | `#191A1A` |
| Raised surface | `#1E1F1F` |
| Highest surface | `#232424` |
| Border | `#303131` |
| Subtle border | `#272828` |
| Primary text | `#E8E7E2` |
| Secondary text | `#A3A39D` |
| Muted text | `#70716C` |

## Accent and States

| Role | Colour |
|---|---|
| Sage accent | `#8FA17C` |
| Light sage | `#A0B18D` |
| Dark sage | `#7C8D6A` |
| Accent text | `#141515` |
| Soft accent fill | `rgba(143, 161, 124, 0.11)` |
| Accent border | `rgba(143, 161, 124, 0.34)` |
| Positive | `#8FA17C` |
| Negative | `#B4776A` |
| Warning | `#B39A63` |
| Informational | `#7189A3` |
| Idle | `#70716C` |

## Visualisation and Integration Colours

| Use | Colours |
|---|---|
| Chart series | `#439A67` - `#B57631` - `#4B8AC9` - `#C26869` |
| Chen diagram highlight | `#C8FF3D` |
| Google sign-in | `#4285F4` - `#34A853` - `#FBBC05` - `#EA4335` |
| Hover borders | `#3A3B3B` - `#3D3E3E` |

## Usage Notes

- Use the shared CSS variables or Tailwind colour tokens for standard interface elements.
- Reserve the sage accent for active states, primary actions, focus indicators, and product identity.
- Use semantic colours with another visual signal such as text, icons, or labels; colour should not be the only indicator of state.
- Keep chart colours limited to the documented series set so legends and comparisons remain consistent.
- The bright `#C8FF3D` highlight is specific to Chen relationship diagrams and is not part of the general UI theme.
