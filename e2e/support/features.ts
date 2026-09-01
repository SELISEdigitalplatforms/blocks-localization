/**
 * TypeScript mirror of features.mjs — keep both files in sync when adding features.
 * The runner reads features.mjs; this file is for IDE autocomplete in specs if needed.
 */
export type WorkflowFeature = {
  id: string
  name: string
  enabled: boolean
  spec: string
}

export const WORKFLOW_FEATURES: WorkflowFeature[] = [
  {
    id: "list",
    name: "Workflow – list",
    enabled: true,
    spec: "tests/workflow/workflow-list.spec.ts",
  },
  {
    id: "create",
    name: "Workflow – create",
    enabled: true,
    spec: "tests/workflow/create-workflow.spec.ts",
  },
  {
    id: "rename",
    name: "Workflow – rename",
    enabled: true,
    spec: "tests/workflow/rename-workflow.spec.ts",
  },
  {
    id: "duplicate",
    name: "Workflow – duplicate",
    enabled: true,
    spec: "tests/workflow/duplicate-workflow.spec.ts",
  },
  {
    id: "delete",
    name: "Workflow – delete",
    enabled: true,
    spec: "tests/workflow/delete-workflow.spec.ts",
  },
  {
    id: "editor",
    name: "Workflow – editor",
    enabled: true,
    spec: "tests/workflow/workflow-editor.spec.ts",
  },
]
