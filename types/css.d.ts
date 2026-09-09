/* Side-effect stylesheet imports (e.g. reactflow/dist/style.css) carry no
   type declarations of their own. Declaring them here keeps both the CLI
   compiler and the editor's language service quiet without reaching for a
   per-import suppression comment. */
declare module '*.css';
