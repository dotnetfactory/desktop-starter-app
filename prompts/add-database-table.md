# Add Database Table

Use this prompt to add a new database table with full CRUD operations.

---

## Prompt

I need to add a new database table to this Electron app.

**Table Name:** [TABLE_NAME]

**Fields:**
- [field1]: [type] - [description]
- [field2]: [type] - [description]
- [field3]: [type] - [description]

Please implement the following:

1. **Database Schema** (`src/database/schema.ts`):
   - Add a `create[TableName]Table()` function following the existing pattern
   - Call it from `initializeDatabase()`
   - Include `id`, `created_at`, `updated_at` fields

2. **IPC Handlers** (`src/ipc/handlers.ts`):
   - `[tableName]:create` - Create a new record
   - `[tableName]:getAll` - Get all records
   - `[tableName]:getById` - Get a single record by ID
   - `[tableName]:update` - Update a record
   - `[tableName]:delete` - Delete a record

3. **Preload API** (`src/preload.ts`):
   - Add a `[tableName]API` object with all CRUD methods
   - Add to `contextBridge.exposeInMainWorld()`

4. **Types** (`src/types/window.ts`):
   - Add interface for the table record type
   - Add interface for the API methods
   - Add to `WindowAPI` interface

Follow existing patterns and use `IPCResponse<T>` for all handlers.

---

## Example

**Table Name:** notes

**Fields:**
- title: TEXT - Note title
- content: TEXT - Note content
- category: TEXT - Optional category

This should create a full notes management system with create, read, update, and delete operations.
