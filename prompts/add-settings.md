# Add Settings Option

Use this prompt to add a new settings option to the Settings panel.

---

## Prompt

I need to add a new settings option to the Settings panel.

**Setting Name:** [SETTING_KEY]

**Setting Type:** [text input / toggle / dropdown / etc.]

**Default Value:** [DEFAULT_VALUE]

**Description:** [WHAT DOES THIS SETTING CONTROL?]

**Tab:** [storage / about / NEW_TAB_NAME]

Please implement:

1. **Settings Component** (`src/renderer/components/Settings.tsx`):
   - Add state for the setting value
   - Load setting value in `useEffect` using `window.api.settings.get('[SETTING_KEY]')`
   - Add UI element (input, toggle, select, etc.)
   - Save on change using `window.api.settings.set('[SETTING_KEY]', value)`
   - If new tab needed, add to `activeTab` type and tab buttons

2. **CSS Styles** (`src/renderer/components/Settings.css`):
   - Add any new styles needed for the UI element

3. **Usage Example**:
   Show how to read this setting elsewhere in the app:
   ```typescript
   const result = await window.api.settings.get('[SETTING_KEY]');
   if (result.success) {
     const value = result.data || '[DEFAULT_VALUE]';
   }
   ```

---

## Example

**Setting Name:** theme

**Setting Type:** dropdown (light / dark / system)

**Default Value:** system

**Description:** Controls the app's color theme

**Tab:** NEW - Appearance

This should add an Appearance tab with a theme selector dropdown.
