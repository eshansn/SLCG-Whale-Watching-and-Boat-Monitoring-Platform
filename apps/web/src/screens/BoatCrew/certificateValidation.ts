export const certificateAccept = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';

export async function certificateError(file?: File): Promise<string | undefined> {
  if (!file) return 'Certificate required. Please upload your certificate before submitting your registration.';
  const extensions: Record<string, RegExp> = { 'application/pdf': /\.pdf$/i, 'image/jpeg': /\.jpe?g$/i, 'image/png': /\.png$/i, 'image/webp': /\.webp$/i };
  if (file.size === 0 || file.size > 5 * 1024 * 1024 || !extensions[file.type]?.test(file.name))
    return 'Choose a PDF, JPEG, PNG, or WebP certificate up to 5 MB.';
  const data = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = new TextDecoder().decode(data);
  const matches = file.type === 'application/pdf' ? text.startsWith('%PDF-')
    : file.type === 'image/jpeg' ? data[0] === 255 && data[1] === 216 && data[2] === 255
    : file.type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => data[i] === byte)
    : text.startsWith('RIFF') && text.slice(8) === 'WEBP';
  return matches ? undefined : 'The certificate content does not match its file type. Please choose a valid certificate.';
}
