import { tStatic, useT } from "@seliseblocks/genesis-os/i18n";

/** Add to a `vi.mock("@seliseblocks/genesis-os", ...)` factory so components using `useT` keep working. */
export const i18nMock = { useT, tStatic };
