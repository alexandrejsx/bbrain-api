import { SummaryContent } from '../value-objects/summary.value-objects';

export interface SummaryComposer {
  compose(evidence: ReadonlyArray<string>): Promise<SummaryContent>;
}
