export interface SafetyPolicy {
  assertNoDiagnosis(content: string): void;
  assertNoMedicationPrescription(content: string): void;
  assertNoOutcomePromise(content: string): void;
}

export interface ClinicalBoundaryPolicy {
  assertWithinCompanionBoundaries(content: string): void;
}

export interface MedicationAdvicePolicy {
  assertNoMedicationAdvice(content: string): void;
}

export interface DiagnosisBoundaryPolicy {
  assertNoDiagnosticClaim(content: string): void;
}

export interface CrisisSignalPolicy {
  identifyCriticalSignals(content: string): ReadonlyArray<string>;
}
