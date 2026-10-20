import { apiFetch } from '../api/httpClient';

export const BOAT_IMAGE_PLACEHOLDER = '/boat-placeholder.svg';

export async function fetchBoatImage(source: string, token: string, signal?: AbortSignal): Promise<Blob> {
  // Send credentials only to our document endpoint, never to an external file URL.
  const isDocument = /^\/api\/operations\/boats\/[\da-f-]+\/(?:image|documents)\/[\da-f-]+$/i.test(source);
  const response = isDocument
    ? await apiFetch(source, { headers: { Authorization: `Bearer ${token}` }, signal })
    : await fetch(source, { signal });
  if (!response.ok) throw new Error(`Unable to load vessel photograph (${response.status}).`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('The vessel photograph is not an image.');
  return blob;
}
