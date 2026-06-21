import { ReflectiveProfile } from '../../conversation/entities/reflective-profile.entity';

describe('ReflectiveProfile', () => {
  it('adds profile values without case-insensitive duplicates', () => {
    const profile = ReflectiveProfile.create('user-id');

    profile.applyUpdate({ recurringThemesToAdd: ['Trabalho', 'trabalho', 'Descanso'] });
    profile.applyUpdate({ recurringThemesToAdd: ['TRABALHO'] });

    expect(profile.toJson().recurringThemes).toEqual(['Trabalho', 'Descanso']);
  });

  it('updates only the interaction date when no reflective update is applied', () => {
    const profile = ReflectiveProfile.create('user-id', new Date('2026-01-01T00:00:00.000Z'));

    profile.registerInteraction(new Date('2026-01-02T00:00:00.000Z'));

    expect(profile.toJson()).toMatchObject({
      recurringThemes: [],
      lastInteractionAt: '2026-01-02T00:00:00.000Z'
    });
  });

  it('applies the summary and additions to every reflective collection', () => {
    const profile = ReflectiveProfile.create('user-id');

    profile.applyUpdate(
      {
        currentContextSummary: 'Contexto atual.',
        recurringThemesToAdd: ['trabalho'],
        emotionalPatternsToAdd: ['sobrecarga no início da semana'],
        routineNotesToAdd: ['dorme tarde'],
        helpfulStrategiesToAdd: ['pausas curtas'],
        unhelpfulStrategiesToAdd: ['adiar o descanso'],
        boundariesToAdd: ['não quer falar sobre rotina']
      },
      new Date('2026-01-03T00:00:00.000Z')
    );

    expect(profile.toJson()).toMatchObject({
      currentContextSummary: 'Contexto atual.',
      recurringThemes: ['trabalho'],
      emotionalPatterns: ['sobrecarga no início da semana'],
      routineNotes: ['dorme tarde'],
      helpfulStrategies: ['pausas curtas'],
      unhelpfulStrategies: ['adiar o descanso'],
      boundaries: ['não quer falar sobre rotina'],
      lastInteractionAt: '2026-01-03T00:00:00.000Z'
    });
  });

  it('configures setup information separately from reflective updates', () => {
    const profile = ReflectiveProfile.create('user-id');

    profile.configureFromSetup(
      {
        preferredTone: 'practical',
        analysisGoals: ['Melhorar rotina', 'Melhorar rotina', ' Sono '],
        reportedFormalDiagnoses: ['TDAH'],
        reportedMedication: 'Medicação com acompanhamento profissional: sim.',
        professionalSupport: 'Terapia atualmente: sim'
      },
      new Date('2026-01-04T00:00:00.000Z')
    );

    expect(profile.toJson()).toMatchObject({
      preferredTone: 'practical',
      analysisGoals: ['Melhorar rotina', 'Sono'],
      reportedFormalDiagnoses: ['TDAH'],
      reportedMedication: 'Medicação com acompanhamento profissional: sim.',
      professionalSupport: 'Terapia atualmente: sim',
      updatedAt: '2026-01-04T00:00:00.000Z'
    });
  });
});
