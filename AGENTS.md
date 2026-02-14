# AGENTS.md

- Do not modify `src/system_components`, `src/SystemStore.js`, 'src/SceneViewer.jsx', 'Helper.js' or 'index.js' without asking first.

## Simplicity And Readability (Highest Priority) 

- Helper.js contains useful functions, use them when possible instead of creating a new one in a component
- Optimize for readability first, speed of understanding second, abstraction last.
- Prefer direct, local code over reusable abstractions.
- Do not create new hooks, utility files, generic helpers, wrappers, or patterns unless explicitly requested.
- Only extract a function/component when it clearly improves readability and the logic is reused in at least 2 places.
- Keep logic close to where it is used; avoid “jumping” across files for simple behavior.
- Avoid `useMemo` / `useCallback` / advanced patterns unless needed for correctness or a known performance issue.
- Prefer explicit names and straightforward control flow (early returns, minimal nesting).
- Keep diffs small and focused; avoid broad refactors when solving a specific task.
- Add concise intent comments only where behavior is not obvious.
- Preserve existing defaults and behavior unless the user asks to change them.
- If an abstraction is added, explain why it is necessary in one sentence in the final response.
- If unsure between “clean abstraction” and “simple explicit code,” choose simple explicit code.