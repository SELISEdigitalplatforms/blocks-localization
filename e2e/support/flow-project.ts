import fs from "fs"
import path from "path"

export type FlowProjectFixture = {
  projectName: string
  itemId: string
  dashboardUrl: string
}

const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/project-name.json")
export const FLOW_SESSION_PATH = path.resolve(__dirname, "../fixtures/flow-session.json")

export function readFlowProject(): FlowProjectFixture | null {
  if (!fs.existsSync(FIXTURE_PATH)) return null
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as FlowProjectFixture
}

export function writeFlowProject(fixture: FlowProjectFixture) {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true })
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2))
}

export function clearFlowProject() {
  if (fs.existsSync(FIXTURE_PATH)) fs.unlinkSync(FIXTURE_PATH)
}

export function clearFlowSession() {
  if (fs.existsSync(FLOW_SESSION_PATH)) fs.unlinkSync(FLOW_SESSION_PATH)
}

export function flowSessionExists(): boolean {
  return fs.existsSync(FLOW_SESSION_PATH)
}
