import { Logger } from '@nestjs/common';
import {
  ObservationExtractionRequest,
  ObservationExtractionResponse,
  ObservationExtractor
} from '../../use-cases/wellbeing-history/ports/observation-extractor.port';

export class ObservationExtractorRouter implements ObservationExtractor {
  private readonly logger = new Logger(ObservationExtractorRouter.name);

  constructor(
    private readonly primary: ObservationExtractor,
    private readonly primaryName: string,
    private readonly fallback?: ObservationExtractor,
    private readonly fallbackName?: string
  ) {}

  async extract(request: ObservationExtractionRequest): Promise<ObservationExtractionResponse> {
    try {
      return await this.primary.extract(request);
    } catch (error) {
      if (!this.fallback || this.primary === this.fallback) throw error;

      this.logger.warn(
        `Observation extraction primary failed primary=${this.primaryName} fallback=${this.fallbackName ?? 'unknown'} errorType=${error instanceof Error ? error.name : 'unknown'}`
      );
      return this.fallback.extract(request);
    }
  }
}
