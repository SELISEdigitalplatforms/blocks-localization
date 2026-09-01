import fs from "fs"
import path from "path"

export type LocalizationProjectFixture = {
  projectName: string
  itemId: string
  dashboardUrl: string
}

const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/localization-project.json")
export const LOCALIZATION_SESSION_PATH = path.resolve(
  __dirname,
  "../fixtures/localization-session.json",
)

export function readLocalizationProject(): LocalizationProjectFixture | null {
  if (!fs.existsSync(FIXTURE_PATH)) return null
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as LocalizationProjectFixture
}

export function writeLocalizationProject(fixture: LocalizationProjectFixture) {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true })
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2))
}

export function clearLocalizationProject() {
  if (fs.existsSync(FIXTURE_PATH)) fs.unlinkSync(FIXTURE_PATH)
}

export function clearLocalizationSession() {
  if (fs.existsSync(LOCALIZATION_SESSION_PATH)) fs.unlinkSync(LOCALIZATION_SESSION_PATH)
}

export function localizationSessionExists(): boolean {
  return fs.existsSync(LOCALIZATION_SESSION_PATH)
}
