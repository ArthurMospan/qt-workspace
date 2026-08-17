# View state: a screen's filters live in its address

Filters used to be `useState` mirrored into `localStorage` per device. Three
ordinary things were therefore impossible: a board could not be sent to anyone,
"my daily board" could not exist on two machines, and the browser's Back button
did not undo a filter because nothing had navigated.

The address is now the single source of truth for what a screen is showing.
There is no `useState` copy of a filter anywhere — two sources can disagree, and
one of them is the one you paste into a message.

## The pieces

- `src/lib/utils/viewState.mjs` — pure serialisation and the schemas. No React.
  Covered by `tests/view-state.test.mjs`.
- `src/lib/hooks/useViewState.js` — binds a schema to `useSearchParams` and
  `router.replace`, and remembers the last visit.

```js
const [state, setState] = useViewState(BOARD_VIEW_SCHEMA, {
  storageKey: `qt:view:board:${projectId}`,
  ready: resourceContextReady,
});

setState({ priority: 'high' });   // a patch, never a whole state
```

## The schema

```js
{ key: { default, values?, type?: 'list' } }
```

- `values` declares the closed set a key accepts. Anything else falls back to
  the default: an address outlives what it points at, and a renamed view mode or
  a hand-edited link must still open the screen.
- `type: 'list'` serialises as `a,b,c`. Its default is `[]`.

Shipped schemas: `BOARD_VIEW_SCHEMA`, `MY_TASKS_VIEW_SCHEMA`,
`SPRINTS_VIEW_SCHEMA`.

## The four rules

1. **A value equal to its default is absent from the address.** An untouched
   board stays `/PROJ`, not `/PROJ?sprint=all&assignee=all&priority=all`.
2. **A key the schema does not declare is never read and never written.** `org`
   (the organization guard), `new` and `assignee` (the task composer) and
   `member` (the profile overlay) survive a filter change untouched. This is why
   `MY_TASKS_VIEW_SCHEMA` deliberately has no `assignee` key: that address
   already carries `assignee` to pre-fill the composer, and one parameter cannot
   mean two things on one screen.
3. **An address that already says something about the screen is never
   overruled.** That is what makes a shared link show the sender's board rather
   than the reader's habits. Only a bare address restores the previous visit,
   and it restores it *into the address*, so a bookmark always captures what you
   are actually looking at. The whole rule is `restoredViewQuery`, and it is
   tested there rather than inside the hook.
4. **A filter change is `replace`, not `push`.** Clicking through four selects
   must not need four presses of Back to leave the screen; each press undoes one
   filter because `replace` still writes the address the next entry is diffed
   against.

## Deliberate omissions

- **Search is not in the address.** `projectSearch`, `myTaskSearch` and
  `sprintSearch` live in the workspace store and are driven by the header, which
  is shared chrome. Binding a store to the address in both directions is a
  second source of truth, which is the thing this change exists to remove.
- **The old per-filter `localStorage` keys are not migrated.** `qt_board_sprint_*`,
  `qt_board_assignee_*`, `qt_board_priority_*`, `qt_board_type_*` and
  `qt_project_view_*` are no longer read or written. Filters reset once, and the
  alternative was carrying a migration shim indefinitely.
- **`/analytics` and `/calendar` are not converted.** They are report screens
  with a different vocabulary — periods and a date anchor — and converting them
  is a separate change.

## Extending it

Add a key to a schema; there is nothing else to register. In particular the
board's `view` key is the extension point for further readings of the same
tasks: adding a table view means adding its value to `BOARD_VIEW_SCHEMA.view.values`
and the columns/sort/grouping keys beside it, so a link to a configured table
works the same way a link to a filtered board already does.
