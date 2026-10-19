# SHEHSWAR ONE360 — Motion & Animation System

## 1. Enterprise Animation Principles

Animations in SHEHSWAR ONE360 exist to **reinforce spatial awareness, confirm user intent, and guide focus** — never as gratuitous decorative embellishments.

### Core Rules
1. **Subtle & Fast**: Transitions should be snappy (120ms to 200ms). Enterprise operators perform repetitive data entry tasks daily; sluggish animations degrade productivity.
2. **Predictable Motion**: Objects enter from expected spatial directions (Drawers slide from right; Modals scale gently from center; Tooltips fade in).
3. **Respect Reduced Motion**: Always respect user accessibility preferences (`@media (prefers-reduced-motion: reduce)` disables non-essential animations).

---

## 2. Motion Tokens

| Token | Duration | Cubic Bezier Curve | Usage |
| :--- | :--- | :--- | :--- |
| `--transition-fast` | `120ms` | `cubic-bezier(0.4, 0, 0.2, 1)` | Button press feedback, tab hover, checkbox toggling |
| `--transition-normal`| `200ms` | `cubic-bezier(0.4, 0, 0.2, 1)` | Dropdown menus, sidebar collapse/expand, tooltips |
| `--transition-slow`  | `350ms` | `cubic-bezier(0.4, 0, 0.2, 1)` | Slide-over drawer entrance, modal backdrops |
| `--transition-bounce`| `300ms` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Notification toast pop-in, badge ping |

---

## 3. Standard Keyframe Animations

### 1. `fadeIn`
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```
Used for modal backdrops, tab switches, and page template swaps.

### 2. `scaleIn`
```css
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
```
Used for Command Menu spotlight, modal dialogs, and toast notifications.

### 3. `slideInRight`
```css
@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
```
Used for slide-over inspection drawers and quick edit sidebars.

### 4. `pulse`
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```
Used for real-time status dots (Submitted, Quarantine, Under Review).

### 5. `skeleton-pulse`
```css
@keyframes skeleton-pulse {
  0% { opacity: 0.6; }
  50% { opacity: 0.25; }
  100% { opacity: 0.6; }
}
```
Used for shimmer table and card placeholders during API network requests.

---

## 4. Micro-Interactions

- **Button Press Feedback**: Immediate `transform: scale(0.98)` on `:active` provides tactile confirmation.
- **Card Hover Elevation**: `transform: translateY(-2px)` with expanded shadow on interactive cards indicates clickability without layout shifts.
- **Sidebar Rail Collapse**: Smooth animated width transition (`280px` to `72px`) preserves label readability during collapse.
