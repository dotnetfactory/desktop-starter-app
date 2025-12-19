# Add New Feature

Use this prompt to add a new feature to the Desktop Starter App.

---

## Prompt

I want to add a new feature to this Electron + React + TypeScript desktop app.

**Feature Name:** [DESCRIBE YOUR FEATURE]

**Feature Description:** [WHAT SHOULD IT DO?]

**User Interface:** [DESCRIBE THE UI - buttons, forms, modals, etc.]

Please help me implement this feature following the existing patterns in the codebase:

1. If the feature needs to store data, add a new database table in `src/database/schema.ts`
2. Add IPC handlers in `src/ipc/handlers.ts` for any main process operations
3. Add preload API methods in `src/preload.ts`
4. Add TypeScript types in `src/types/window.ts`
5. Create React components in `src/renderer/components/`
6. Add CSS styles following the existing patterns

Key files to reference:
- `src/database/schema.ts` - Database table patterns
- `src/ipc/handlers.ts` - IPC handler patterns
- `src/preload.ts` - API exposure patterns
- `src/types/window.ts` - Type definitions
- `src/renderer/components/Settings.tsx` - Component patterns
- `src/renderer/styles/globals.css` - CSS variables

Follow the IPCResponse pattern for all IPC handlers:
```typescript
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}
```

---

## Example

**Feature Name:** Task List

**Feature Description:** A simple task list where users can add, complete, and delete tasks.

**User Interface:**
- A list showing all tasks with checkboxes
- An input field to add new tasks
- Delete buttons for each task
- Tasks should persist in the database
