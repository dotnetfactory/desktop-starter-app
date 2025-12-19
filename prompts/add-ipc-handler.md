# Add IPC Handler

Use this prompt to add a new IPC handler for main/renderer process communication.

---

## Prompt

I need to add a new IPC handler to communicate between the renderer and main process.

**Handler Name:** [namespace:action]

**Purpose:** [WHAT DOES THIS HANDLER DO?]

**Parameters:**
- [param1]: [type] - [description]
- [param2]: [type] - [description]

**Return Type:** [WHAT DOES IT RETURN?]

Please implement following the existing patterns:

1. **IPC Handler** (`src/ipc/handlers.ts`):
   ```typescript
   ipcMain.handle('[namespace:action]', async (_, param1, param2) => {
     try {
       // Implementation
       return { success: true, data: result };
     } catch (error) {
       return { success: false, error: { code: 'ERROR_CODE', message: String(error) } };
     }
   });
   ```

2. **Preload API** (`src/preload.ts`):
   ```typescript
   const [namespace]API = {
     [action]: (param1, param2) => ipcRenderer.invoke('[namespace:action]', param1, param2),
   };
   ```
   Add to existing API or create new one and add to `exposeInMainWorld()`.

3. **Types** (`src/types/window.ts`):
   - Add interface for return type if complex
   - Add method signature to API interface
   - Update `WindowAPI` interface if adding new namespace

---

## Example

**Handler Name:** files:readJson

**Purpose:** Read and parse a JSON file from disk

**Parameters:**
- filePath: string - Path to the JSON file

**Return Type:** The parsed JSON object

This should let the renderer request file reading from the main process.
