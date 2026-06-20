export interface InsightEvidenceBuilder {
  buildEvidence(userId: string, startsAt: Date, endsAt: Date): Promise<ReadonlyArray<string>>;
}
