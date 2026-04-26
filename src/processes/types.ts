export type StepType = "auto" | "human";

export interface StepDefinition {
  id: string;
  type: StepType;
  adapter: string;
  title: string;
  promptKey?: string;
}

export interface ProcessDefinitionSpec {
  slug: string;
  title: string;
  version: number;
  steps: StepDefinition[];
}
