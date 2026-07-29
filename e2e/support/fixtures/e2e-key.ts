import fs from "node:fs/promises";
import { E2E_KEY_FIXTURE_PATH } from "../constants";
import { uniqueName } from "../test-base";

export const buildKeyName = () => uniqueName("e2e");

export const saveE2eKey = async (keyName: string) => {
  await fs.writeFile(E2E_KEY_FIXTURE_PATH, `${JSON.stringify({ keyName }, null, 2)}\n`, "utf-8");
};

export const readE2eKey = async (): Promise<string> => {
  const raw = await fs.readFile(E2E_KEY_FIXTURE_PATH, "utf-8");
  const parsed = JSON.parse(raw) as { keyName?: string };

  if (!parsed.keyName) {
    throw new Error("Missing keyName in fixtures/e2e-key.json — run add-key spec first.");
  }

  return parsed.keyName;
};
