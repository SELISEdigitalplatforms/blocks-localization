# Skeleton loading (uilm-react)

**`boneyard-js` is not installed** in this package. Loaders use **`Loader2`** from `lucide-react` and TanStack Query `isLoading` / `isFetching` flags (see e.g. [`key-detail-page.tsx`](../../../src/features/uilm/pages/key-detail-page.tsx)).

For layout placeholders, use the platform **`Skeleton`** component from `@/platform/ui` if synced from the monolith, or simple pulse `div`s (`animate-pulse bg-muted`) consistent with [`project-card-loading.tsx`](../../../src/features/console/components/project-card-loading.tsx).

## Verify

```bash
cd uilm-react && npm run lint
```
