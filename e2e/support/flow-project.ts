import fs from "fs";
import path from "path";

// Mirrors blocks-logic's support/workflow-project.ts: the shared project
// opened once by flow.setup.spec.ts, and its session, reused by every flow
// spec instead of each spec re-entering the Development environment itself
// (that repeated re-entry is what triggered a real "session_expired" 401 from
// the backend on the second+ impersonation attempt in the same session).
export type FlowProjectFixture = {
  projectName: string;
  itemId: string;
  dashboardUrl: string;
  // false for a reused project (explicit id/name, or a leftover orphan) --
  // teardown must never auto-delete one of those.
  wasCreated: boolean;
};

const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/project-name.json");
export const FLOW_SESSION_PATH = path.resolve(__dirname, "../fixtures/flow-session.json");

export function readFlowProject(): FlowProjectFixture | null {
  if (!fs.existsSync(FIXTURE_PATH)) return null;
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as FlowProjectFixture;
}

export function writeFlowProject(fixture: FlowProjectFixture) {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
}

export function clearFlowProject() {
  if (fs.existsSync(FIXTURE_PATH)) fs.unlinkSync(FIXTURE_PATH);
}

export function clearFlowSession() {
  if (fs.existsSync(FLOW_SESSION_PATH)) fs.unlinkSync(FLOW_SESSION_PATH);
}
