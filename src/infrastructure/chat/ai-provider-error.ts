interface AiProviderErrorBody {
  error?: {
    code?: number;
    status?: string;
    type?: string;
  };
}

const sanitizeLogValue = (value: string): string => value.replace(/\s+/g, ' ').trim().slice(0, 500);

export async function describeProviderHttpError(response: Response): Promise<string> {
  const details = [`httpStatus=${response.status}`];

  try {
    const body = (await response.json()) as AiProviderErrorBody;

    if (body.error?.code !== undefined) {
      details.push(`code=${body.error.code}`);
    }

    if (body.error?.status) {
      details.push(`status=${sanitizeLogValue(body.error.status)}`);
    }

    if (body.error?.type) {
      details.push(`type=${sanitizeLogValue(body.error.type)}`);
    }
  } catch {
    details.push(`statusText=${sanitizeLogValue(response.statusText)}`);
  }

  return details.join(' ');
}

export function describeProviderError(error: unknown): string {
  if (error instanceof Error) {
    return `errorType=${sanitizeLogValue(error.name)}`;
  }

  return 'Unknown provider error';
}
