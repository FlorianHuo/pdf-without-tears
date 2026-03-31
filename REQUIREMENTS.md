# PDF Toolkit - Library Refactoring Requirements

You are tasked with turning this prototype PDF viewer into a fully-functional library management tool. 
Please perform a comprehensive refactoring in one go. Do not stop until you have implemented all the following features:

## 1. Delete and Remove Books
- Add a mechanism (using `BookContextMenu` or a delete button on `BookCard`) to delete a book from the library.
- Call the `deleteBook` API from `src/utils/db.ts`.
- Ensure it asks for confirmation before deleting via the `ConfirmDialog`.

## 2. Reorder Books (Drag and Drop)
- Add a custom sort order capability to the Library Grid.
- Use native HTML5 Drag and Drop (or implement a simple sortable grid) so users can rearrange books.
- Save the new order structure permanently.

## 3. Categorization and Archiving
- Mount the `FilterBar` component to allow users to filter by tags and categories.
- Ensure the `activeCategory` and `activeTags` states in `App.tsx` correctly filter the `LibraryView`.
- Enable the Archive function in the context menu so books can be hidden from the main view.

## Execution Rules
- Review all provided files.
- Return full file contents with the exact required file listing format.
- DO NOT use placeholders. Do everything in completely functional, production-ready code.
