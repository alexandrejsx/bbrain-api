import { checkInToolNames } from '../tools/check-in.tools';
import { conversationToolNames } from '../tools/conversation.tools';
import { journalToolNames } from '../tools/journal.tools';
import { memoryToolNames } from '../tools/memory.tools';
import { patternAnalysisToolNames } from '../tools/pattern-analysis.tools';
import { riskAssessmentToolNames } from '../tools/risk-assessment.tools';
import { summaryToolNames } from '../tools/summary.tools';
import { supportPlanToolNames } from '../tools/support-plan.tools';
import { safetyGuardrailNames } from '../guardrails/safety.guardrails';
import { AgentDefinition } from './agent-definition';

export const companionAgent: AgentDefinition = {
  name: 'Companion Agent',
  promptStatus: 'available',
  promptKey: 'companion',
  toolNames: [
    ...conversationToolNames,
    ...memoryToolNames,
    ...checkInToolNames,
    ...journalToolNames,
    ...supportPlanToolNames,
    ...riskAssessmentToolNames
  ],
  guardrailNames: safetyGuardrailNames,
  handoffNames: ['Memory Agent', 'Pattern Agent', 'Summary Agent', 'Safety Agent']
};

export const memoryAgent: AgentDefinition = {
  name: 'Memory Agent',
  promptStatus: 'not-implemented',
  toolNames: memoryToolNames,
  guardrailNames: safetyGuardrailNames,
  handoffNames: []
};

export const patternAgent: AgentDefinition = {
  name: 'Pattern Agent',
  promptStatus: 'not-implemented',
  toolNames: patternAnalysisToolNames,
  guardrailNames: safetyGuardrailNames,
  handoffNames: []
};

export const summaryAgent: AgentDefinition = {
  name: 'Summary Agent',
  promptStatus: 'not-implemented',
  toolNames: summaryToolNames,
  guardrailNames: safetyGuardrailNames,
  handoffNames: []
};

export const safetyAgent: AgentDefinition = {
  name: 'Safety Agent',
  promptStatus: 'not-implemented',
  toolNames: riskAssessmentToolNames,
  guardrailNames: safetyGuardrailNames,
  handoffNames: []
};

export const agentRegistry = [
  companionAgent,
  memoryAgent,
  patternAgent,
  summaryAgent,
  safetyAgent
] as const;
