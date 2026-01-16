# Patch: Font Size Increase & Light Mode Readability Improvements

**Date:** 2025-01-27  
**Version:** 1.0.11  
**Type:** UI/UX Enhancement

## Summary

This patch increases all font sizes by one step (text-xs → text-sm, text-sm → text-base, etc.) and improves light mode readability by making text darker and bolder.

## Changes Made

### 1. Light Mode Text Colors (Darker)
**File:** `lib/theme/tokens.css`

- **Primary text (`--text-1`):** Changed from `#1F2933` to `#0F172A` (darker)
- **Secondary text (`--text-2`):** Changed from `#5F6C7B` to `#334155` (darker)
- **Input text (`--input-text`):** Changed from `#1F2933` to `#0F172A` (darker)
- **Input placeholder (`--input-placeholder`):** Changed from `#95A2B3` to `#64748B` (darker)
- **Disabled text (`--disabled-text`):** Changed from `#95A2B3` to `#64748B` (darker)
- **Code text (`--code-text`):** Changed from `#1F2933` to `#0F172A` (darker)

### 2. Font Weight Adjustments (Light Mode)
**File:** `app/globals.css`

Added font-weight rules for light mode:
- Base body font: `font-weight: 500` (medium weight)
- `.text-theme`: `font-weight: 500`
- `.text-theme-muted`: `font-weight: 500`
- `.text-theme-subtle`: `font-weight: 500` with `opacity: 0.9` (more visible)
- `.glass`, `.glass-button`, `.glass-input`, `.glass-card`: `font-weight: 500`
- `label`, `.text-sm`, `.text-base`: `font-weight: 500`
- `.text-xs`: `font-weight: 500`

### 3. Base Font Size (Light Mode)
**File:** `app/globals.css`

- Light mode body font size: `1.0625rem` (17px) - slightly larger than default 16px

### 4. Font Size Increases (All Components)

#### MessageBubble.tsx
- Message content: `text-sm` → `text-base`
- Threat indicators: `text-xs` → `text-sm`
- Timestamp: `text-xs` → `text-sm`
- All scan result text: `text-xs` → `text-sm`

#### MessageInput.tsx
- Input field: Added `text-base`
- Send button: Added `text-base`
- Helper text: `text-xs` → `text-sm`

#### ChatInterface.tsx
- Error messages: `text-sm` → `text-base`

#### SettingsForm.tsx
- Input fields: `text-sm` → `text-base`
- Labels: `text-sm` → `text-base`
- Headings: `text-xl` → `text-2xl`
- Clear buttons: `text-sm` → `text-base`
- Helper text: `text-xs` → `text-sm`
- All status messages: `text-xs` → `text-sm`

#### ModelSelector.tsx
- Loading/error messages: `text-xs` → `text-sm`
- Label: `text-sm` → `text-base`
- Select/input fields: `text-sm` → `text-base`

#### FileList.tsx
- All badges: `text-xs` → `text-sm`
- File details: `text-xs` → `text-sm`
- Scan details: `text-xs` → `text-sm`

## Font Size Mapping

| Old Size | New Size | Pixel Size |
|----------|----------|------------|
| `text-xs` | `text-sm` | 12px → 14px |
| `text-sm` | `text-base` | 14px → 16px |
| `text-base` | `text-lg` | 16px → 18px (if used) |
| `text-xl` | `text-2xl` | 20px → 24px |

## Light Mode Improvements

### Before
- Primary text: `#1F2933` (RGB: 31, 41, 51) - Medium gray
- Secondary text: `#5F6C7B` (RGB: 95, 108, 123) - Light gray (hard to read)
- Font weight: `normal` (400)
- Base font size: `16px`

### After
- Primary text: `#0F172A` (RGB: 15, 23, 42) - Darker, more readable
- Secondary text: `#334155` (RGB: 51, 65, 85) - Darker, more readable
- Font weight: `500` (medium) - Bolder
- Base font size: `17px` - Slightly larger

## Files Modified

### Core Theme Files
1. `lib/theme/tokens.css` - Light mode text colors
2. `app/globals.css` - Font weight rules and base font size

### Chat Components
3. `components/MessageBubble.tsx` - Font size increases
4. `components/MessageInput.tsx` - Font size increases
5. `components/ChatInterface.tsx` - Font size increases
6. `components/ChatHeader.tsx` - Font size increases

### Settings & Configuration
7. `components/SettingsForm.tsx` - Font size increases
8. `components/ModelSelector.tsx` - Font size increases

### File Management
9. `components/FileList.tsx` - Font size increases
10. `components/FileUploader.tsx` - Font size increases

### Layout & Navigation
11. `components/Layout.tsx` - Font size increases

### Logging & Monitoring
12. `components/LogViewer.tsx` - Font size increases
13. `components/SystemLogViewer.tsx` - Font size increases

### Risk Management
14. `components/RiskMap.tsx` - Font size increases
15. `components/RiskDetail.tsx` - Font size increases

### Pages
16. `app/page.tsx` - Font size increases
17. `app/dashboard/page.tsx` - Font size increases
18. `app/risk-map/page.tsx` - Font size increases
19. `app/files/page.tsx` - Font size increases
20. `app/release-notes/page.tsx` - Font size increases

**Total: 20 files modified**

## Testing Checklist

- [x] All font sizes increased by one step
- [x] Light mode text is darker and more readable
- [x] Light mode text is bolder (font-weight: 500)
- [x] Dark mode remains unchanged
- [x] No TypeScript/linter errors
- [ ] Visual testing in browser (light mode)
- [ ] Visual testing in browser (dark mode)
- [ ] Responsive design validation

## Impact

### Positive
- ✅ Better readability in light mode
- ✅ Larger fonts improve accessibility
- ✅ Bolder text improves contrast
- ✅ Darker colors meet WCAG AA contrast requirements

### Neutral
- No breaking changes
- Dark mode unchanged
- All functionality preserved

## Notes

- Dark mode colors and font weights remain unchanged
- All changes are CSS-only (no TypeScript logic changes)
- Font size increases are consistent across all components
- Light mode improvements specifically address user feedback about gray text being hard to read
