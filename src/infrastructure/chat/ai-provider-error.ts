interface AiProviderErrorBody {
  error?: {
    code?: number;
    message?: string;
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

    if (body.error?.message) {
      details.push(`message=${sanitizeLogValue(body.error.message)}`);
    }
  } catch {
    details.push(`statusText=${sanitizeLogValue(response.statusText)}`);
  }

  return details.join(' ');
}

export function describeProviderError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${sanitizeLogValue(error.message)}`;
  }

  return 'Unknown provider error';
}
