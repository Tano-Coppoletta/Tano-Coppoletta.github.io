# Home page overrides

The home page follows the Claude Design file **Portfolio.dc.html** (project "Gaetano's portfolio website"), with the changes listed below.

- **Palette:** warm off-white `#F5F4EF`, white cards, ink `#171714`, one orange accent `oklch(0.58 0.17 40)`. Dark panels (community, footer) use the ink colour. A dark theme exists only for the header toggle; light is the default.
- **Type:** Geist for everything, Geist Mono for small uppercase labels and dates, Instrument Serif italic for one emphasised phrase per block (hero, community title, about lead, footer email). Headings are weight 400 with tight negative tracking.
- **Geometry:** pill buttons and tags (999px radius), 24px cards, 20px portrait corners, 16px illustration frames. Cards lift 3px with a soft shadow on hover.
- **Hero:** headline + intro + "View work" / "Get in touch" + route line (past places struck through, San Francisco highlighted with an orange dot), portrait at 4:5 on the right, wrapping below on narrow screens. An animated node network sits behind the hero top and reacts to the pointer.
- **Highlights strip:** four figures between top and bottom rules.
- **Selected work:** one full-width Oracle card (illustration left, text, two outcomes, tags), then GorgeousTV and OCPPStorm side by side. Illustrations are HTML concept drawings in `src/components/ProjectVisual.astro`, not product screenshots.
- **Experience:** native `<details>` accordion, one open at a time, first open by default.
- **Custom cursor:** pointer devices only. Dot + trailing ring everywhere, text included (no I-beam); labels "Open"/"Close" on roles, "↗" on new-tab links, "Copy" on the footer email (click copies it).
- **Get in touch:** scrolls to the contact footer (not a mailto: link, which does nothing without a mail app).
- **Phones (≤720px):** name, theme toggle and a burger menu on one row; links drop down below.
- **Phones (≤560px):** portrait 168px wide, the city route as one inline line, highlights in a 2×2 grid.
