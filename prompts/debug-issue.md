# Debug Issue

Use this prompt to get help debugging issues in the app.

---

## Prompt

I'm experiencing an issue with this Electron + React + TypeScript desktop app.

**Issue Description:** [DESCRIBE THE PROBLEM]

**Expected Behavior:** [WHAT SHOULD HAPPEN?]

**Actual Behavior:** [WHAT ACTUALLY HAPPENS?]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Error Messages (if any):**
```
[PASTE ERROR MESSAGES HERE]
```

**Relevant Code:**
```typescript
[PASTE RELEVANT CODE HERE]
```

Please help me debug this issue. Consider:

1. **Main Process Issues** (`src/main.ts`, `src/ipc/handlers.ts`):
   - Check console output with `console.log('[App]', ...)`
   - IPC handlers return `IPCResponse` - check for error handling

2. **Renderer Process Issues** (`src/renderer/`):
   - Check browser DevTools console (Cmd+Option+I / Ctrl+Shift+I)
   - Check if `window.api` methods are being called correctly

3. **Database Issues** (`src/database/`):
   - SQLite errors often include helpful messages
   - Check if tables exist and have correct schema

4. **IPC Communication Issues**:
   - Verify handler is registered in `src/ipc/handlers.ts`
   - Verify API is exposed in `src/preload.ts`
   - Verify types match in `src/types/window.ts`

5. **Build Issues**:
   - Run `npm run lint` to check for TypeScript errors
   - Check `vite.*.config.ts` for build configuration

---

## Example

**Issue Description:** Settings aren't being saved

**Expected Behavior:** When I change a setting and close the app, it should persist

**Actual Behavior:** Settings reset to defaults on app restart

**Error Messages:**
```
[App] Failed to save window state: SQLITE_ERROR: no such table: settings
```

This error suggests the settings table wasn't created - check `initializeDatabase()`.
