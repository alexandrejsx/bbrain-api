import { Logger } from '@nestjs/common';
import {
  CaptureWellbeingObservationsInput,
  CaptureWellbeingObservationsUseCase
} from './capture-wellbeing-observations.use-case';
import { WellbeingCaptureCoordinator } from './wellbeing-capture-coordinator.service';

export class WellbeingObservationCaptureScheduler {
  private readonly logger = new Logger(WellbeingObservationCaptureScheduler.name);

  constructor(
    private readonly enabled: boolean,
    private readonly capture: CaptureWellbeingObservationsUseCase,
    private readonly coordinator: WellbeingCaptureCoordinator
  ) {}

  schedule(input: CaptureWellbeingObservationsInput): void {
    if (!this.enabled || !input.allowAutomaticCapture) return;

    const pending = this.coordinator.run(input.userId, () => this.capture.execute(input));
    if (!pending) return;

    void pending
      .then((result) => {
        this.logger.debug(
          `Wellbeing capture completed status=${result.status} extracted=${result.extracted} accepted=${result.accepted} created=${result.created} corrected=${result.corrected} wouldCreate=${result.wouldCreate} wouldCorrect=${result.wouldCorrect} rejected=${result.rejected} deduplicated=${result.deduplicated}`
        );
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Wellbeing capture failed errorType=${error instanceof Error ? error.name : 'unknown'}`
        );
      });
  }
}
