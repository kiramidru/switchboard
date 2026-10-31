import type { Analysis, Example, Health } from './types';

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = 'The server could not complete this request. Please try again.';
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') message = body.detail;
    } catch { /* A proxy may return non-JSON errors. */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const getHealth = () => fetch('/api/health').then(readResponse<Health>);
export const getExamples = () => fetch('/api/examples').then(readResponse<Example[]>);
export async function analyzeNotice(data: FormData, signal: AbortSignal): Promise<Analysis> {
  return readResponse<Analysis>(await fetch('/api/analyze', { method: 'POST', body: data, signal }));
}
