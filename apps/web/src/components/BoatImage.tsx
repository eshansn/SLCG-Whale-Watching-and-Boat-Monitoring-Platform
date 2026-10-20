import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { useAuth } from '../auth/useAuth';
import { BOAT_IMAGE_PLACEHOLDER, fetchBoatImage } from '../operations/boatImage';

export default function BoatImage({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [loaded, setLoaded] = useState<{ source: string; token: string; url: string }>();

  useEffect(() => {
    if (!src || src === BOAT_IMAGE_PLACEHOLDER || !token) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void fetchBoatImage(src, token, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ source: src, token, url: objectUrl });
    }).catch(() => { /* Keep the placeholder if the file cannot be loaded. */ });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, token]);

  const url = loaded && loaded.source === src && loaded.token === token ? loaded.url : BOAT_IMAGE_PLACEHOLDER;
  return <img {...props} src={url} alt={alt} onError={event => {
    event.currentTarget.src = BOAT_IMAGE_PLACEHOLDER;
  }} />;
}
