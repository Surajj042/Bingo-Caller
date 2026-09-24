# Fix Select Dropdown Scroll Behavior

## Goal
The 5-option dropdown menu closes when the user tries to scroll inside it with a mouse wheel or drag, making the menu appear non-scrollable. Also improve keyboard navigation so arrow-key movement past the visible rows scrolls the menu smoothly.

## Root Cause
`script.js:743` registers a capture-phase `scroll` listener on `document` that calls `closeAllSelects()` on any scroll event. Because scroll events fire in capture phase on `document` even when the scroll originates inside the dropdown, the menu closes immediately when the user attempts to scroll it.

## Changes

### 1. Ignore scroll events from inside the dropdown (`script.js:743`)
Replace the current scroll listener with one that checks whether the event target is inside `selectLayer` before closing.

Current:
```js
document.addEventListener("scroll", () => {
  if (activeSelect) closeAllSelects();
}, true);
```

Updated:
```js
document.addEventListener("scroll", (event) => {
  if (!activeSelect) return;
  if (selectLayer.contains(event.target)) return;
  closeAllSelects();
}, true);
```

### 2. Smooth keyboard scrolling (`script.js:538, 544, 547`)
Add `scrollIntoView({ block: "nearest" })` to the three `.focus()` calls so arrow-key navigation scrolls the menu without moving the page.

- `script.js:538` — `target.focus();` → `target.focus(); target.scrollIntoView({ block: "nearest" });`
- `script.js:544` — `items[current + 1].focus();` → `items[current + 1].focus(); items[current + 1].scrollIntoView({ block: "nearest" });`
- `script.js:547` — `items[current - 1].focus();` → `items[current - 1].focus(); items[current - 1].scrollIntoView({ block: "nearest" });`

## Validation
1. Open the select dropdown.
2. Scroll inside the menu with mouse wheel or drag — the menu should stay open and scroll.
3. Use arrow keys to move past the visible rows — the menu should scroll smoothly and the page should not jump.
