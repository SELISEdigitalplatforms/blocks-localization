import fs from "fs";
import path from "path";

const PROJECT_NAME_FILE = path.resolve(__dirname, "../fixtures/project.json");

interface ProjectNameFile {
  projectName: string;
}

let cached: string | undefined;

export function getProjectName(): string {
  if (cached) return cached;

  if (!fs.existsSync(PROJECT_NAME_FILE)) {
    throw new Error(
      `Project name fixture not found at ${PROJECT_NAME_FILE}. ` +
        `Run the setup project first (it writes this file after creating the project in OS).`,
    );
  }

  const raw = fs.readFileSync(PROJECT_NAME_FILE, "utf8");
  let parsed: ProjectNameFile;
  try {
    parsed = JSON.parse(raw) as ProjectNameFile;
  } catch {
    throw new Error(`Project name fixture at ${PROJECT_NAME_FILE} is not valid JSON.`);
  }

  if (!parsed.projectName || typeof parsed.projectName !== "string") {
    throw new Error(
      `Project name fixture at ${PROJECT_NAME_FILE} is missing the "projectName" field.`,
    );
  }

  cached = parsed.projectName;
  return cached;
}

export const PROJECT_NAME_FILE_PATH = PROJECT_NAME_FILE;