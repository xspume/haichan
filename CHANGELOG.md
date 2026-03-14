# Changelog

## 2026-03-14

### Fixed
- Restored TypeScript health for key posting/navigation flows by resolving route, upload result, and callback typing issues.
- Added a dedicated `OrbCallbackPage` route component to prevent `/auth/orb/callback` from hard-failing and to redirect users safely back to `/auth`.
- Fixed thread detail refresh callback scope and toast usage typing in `ThreadDetailPage`.
- Corrected `BoardCatalog` link ref typing and `ChatRoomsPage` public DB import.

### Verified
- `npm run lint:types` passes.
- `npm test -- --run` passes (17/17 tests).
- `npm run build` succeeds.
