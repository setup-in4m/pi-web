# Progress

## Status
In Progress (Round 2)

## Tasks
- [x] Fix #5: Settings content truncated → `min-h-0` added to content area, `max-h` 85vh→90vh
- [ ] Fix #4 (partial): Extension name hierarchy — deferred (🟡Minor, not Critical/Major)
- [ ] N1-N5: Minor/Cosmetic issues — deferred

## Files Changed
- `client/src/components/settings/SettingsDialog.tsx` (line 252: `max-h-[90vh]`, line 278: added `min-h-0`)

## Notes
- Root cause: flex child with `overflow-y-auto` needs `min-h-0` to allow shrinking below content intrinsic height. Without it, `min-height: auto` forces container past `max-h`, outer `overflow-hidden` clips content. Fix makes inner scrollbar work correctly.
