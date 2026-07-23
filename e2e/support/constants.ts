/** Key name shared between add-key and delete-key specs. */
export const E2E_KEY_FIXTURE_PATH = "fixtures/e2e-key.json"

/** Post-login routes: project console list or project workspace. */
export const AUTHENTICATED_APP_URL =
  /\/app\/(console|[0-9a-f-]{36}\/(dashboard|services|profile))/
