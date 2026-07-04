import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

function listTypescriptFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return listTypescriptFiles(path);
    }

    return path.endsWith('.ts') ? [path] : [];
  });
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('chat agent architecture boundaries', () => {
  it('keeps production domain files independent from application, infrastructure and modules', () => {
    const files = listTypescriptFiles(join(root, 'src/domain')).filter(
      (file) => !file.includes('/__tests__/')
    );
    const violations = files
      .filter((file) => /@nestjs|from ['"].*(use-cases|infrastructure|modules)/.test(read(file)))
      .map((file) => relative(root, file));

    expect(violations).toEqual([]);
  });

  it('keeps conversation use cases independent from infrastructure and modules', () => {
    const files = listTypescriptFiles(join(root, 'src/use-cases/conversation'));
    const violations = files
      .filter((file) => /from ['"].*(infrastructure|modules)/.test(read(file)))
      .map((file) => relative(root, file));

    expect(violations).toEqual([]);
  });

  it('does not keep unused agent-worker orchestration scaffolding', () => {
    expect(listTypescriptFiles(join(root, 'src/infrastructure/agent-worker'))).toEqual([]);
  });

  it('keeps OpenAI and Gemini references in infrastructure or composition only', () => {
    const files = listTypescriptFiles(join(root, 'src')).filter(
      (file) => !file.includes('/__tests__/') && relative(root, file) !== 'src/config.ts'
    );
    const violations = files
      .filter((file) => !file.includes('/infrastructure/') && !file.includes('/modules/'))
      .filter((file) => /OpenAI|OpenAi|Gemini/.test(read(file)))
      .map((file) => relative(root, file));

    expect(violations).toEqual([]);
  });
});
