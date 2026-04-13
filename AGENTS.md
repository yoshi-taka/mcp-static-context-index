# Agent Notes

- Use `bun` for package management and script execution in this repository.
- Do not use `npm / npx` for install, add, remove, or run tasks when a `bun` equivalent exists.
- Prefer:
  - `bun install`
  - `bun add <pkg>`
  - `bun remove <pkg>`
  - `bun run <script>`
  - `bunx <pkg>`
