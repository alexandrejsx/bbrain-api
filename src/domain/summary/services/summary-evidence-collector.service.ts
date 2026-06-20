export interface SummaryEvidenceCollector {
  collect(userId: string, startsAt: Date, endsAt: Date): Promise<ReadonlyArray<string>>;
}
