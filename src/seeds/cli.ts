import { createConnection } from 'mongoose';
import { resolveMongoDbConfig } from '../config';
import { MoodRepository } from '../modules/mood/mood.repository';
import { MoodMongo, MoodSchema } from '../modules/mood/mood.schema';
import { MoodService } from '../modules/mood/mood.service';
import { SleepRepository } from '../modules/sleep/sleep.repository';
import { SleepMongo, SleepSchema } from '../modules/sleep/sleep.schema';
import { SleepService } from '../modules/sleep/sleep.service';
import { runMoodSeed } from './mood.seed';
import { runSleepSeed } from './sleep.seed';

const SEED_NAMES = ['mood', 'sleep'] as const;
type SeedName = (typeof SEED_NAMES)[number];

function printHelp(seedName?: string): void {
  if (seedName) console.error(`Seed desconhecida: ${seedName}\n`);
  console.error(`Disponíveis:\n${SEED_NAMES.map((name) => `- ${name}`).join('\n')}`);
}

function isSeedName(value: string | undefined): value is SeedName {
  return SEED_NAMES.includes(value as SeedName);
}

function isLocalMongoUri(uri: string): boolean {
  try {
    const hostname = new URL(uri).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

function validateEnvironment(uri: string): void {
  const seedEnvironment = process.env.SEED_ENV;
  if (seedEnvironment === 'local') {
    if (process.env.NODE_ENV !== 'local' || !isLocalMongoUri(uri)) {
      throw new Error('seeds:local exige NODE_ENV=local e um MONGODB_URI local.');
    }
    return;
  }
  if (seedEnvironment !== 'production' || process.env.NODE_ENV !== 'production') {
    throw new Error('Ambiente de seed inválido. Use seeds:local ou seeds:prod.');
  }
  if (isLocalMongoUri(uri)) {
    throw new Error('seeds:prod não pode usar um MONGODB_URI local.');
  }
  if (process.env.SEED_PRODUCTION_CONFIRM !== 'seed-bbrain-production') {
    throw new Error(
      'Produção bloqueada. Defina SEED_PRODUCTION_CONFIRM=seed-bbrain-production conscientemente.'
    );
  }
}

async function main(): Promise<void> {
  const seedName = process.argv[2];
  if (!isSeedName(seedName)) {
    printHelp(seedName);
    process.exitCode = 1;
    return;
  }

  const { uri, dbName } = resolveMongoDbConfig();
  validateEnvironment(uri);
  const seedUserId = process.env.SEED_USER_ID?.trim();
  const seedUserEmail = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  if (!seedUserId && !seedUserEmail) {
    throw new Error('Defina SEED_USER_ID ou SEED_USER_EMAIL para identificar o usuário da seed.');
  }

  const connection = createConnection(uri, { dbName });
  try {
    await connection.asPromise();
    const user = await connection
      .collection<{ _id: string; email: string; timezone?: string }>('users')
      .findOne(seedUserId ? { _id: seedUserId } : { email: seedUserEmail });
    if (!user) throw new Error('Usuário da seed não encontrado no banco configurado.');

    const timezone = user.timezone || 'America/Sao_Paulo';
    const moodModel = connection.model(MoodMongo.name, MoodSchema);
    const sleepModel = connection.model(SleepMongo.name, SleepSchema);
    await Promise.all([moodModel.createIndexes(), sleepModel.createIndexes()]);

    if (seedName === 'mood') {
      const repository = new MoodRepository(moodModel as never);
      const result = await runMoodSeed({
        userId: user._id,
        timezone,
        referenceAt: new Date(),
        service: new MoodService(repository),
        repository
      });
      console.log(
        `Seed mood concluída: ${result.created} documentos criados (${result.deleted} anteriores removidos).`
      );
      return;
    }

    const repository = new SleepRepository(sleepModel as never);
    const result = await runSleepSeed({
      userId: user._id,
      timezone,
      referenceAt: new Date(),
      replaceAll: process.env.SEED_ENV === 'local',
      service: new SleepService(repository),
      repository
    });
    console.log(
      `Seed sleep concluída: ${result.created} documentos criados (${result.deleted} anteriores removidos).`
    );
  } finally {
    await connection.close().catch(() => undefined);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Falha desconhecida ao executar a seed.');
  process.exitCode = 1;
});
