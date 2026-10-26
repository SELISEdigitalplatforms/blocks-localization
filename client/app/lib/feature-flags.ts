import { getRuntimeEnv } from "@/lib/runtime-env";

/**
 * Glossary-aware AI suggestions (matching, terminology prompt, output checks) and the
 * glossary Variants / Case-sensitive fields. Off unless the runtime value is "true";
 * an unreplaced `__BLOCKS_GLOSSARY_ENFORCEMENT__` placeholder counts as unset.
 */
export const isGlossaryEnforcementEnabled = (): boolean =>
  getRuntimeEnv("BLOCKS_GLOSSARY_ENFORCEMENT")?.toLowerCase() === "true";
