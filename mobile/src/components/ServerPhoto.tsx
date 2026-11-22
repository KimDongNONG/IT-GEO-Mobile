// 서버에 저장된 사진 (로그인 세션이 필요해서 fetch → blob 으로 보여 줌)
import { useEffect, useState } from 'react';
import { blobUrl } from '../api/client';
import { photoPath } from '../api/itgeo';

export default function ServerPhoto({ id, alt, className }: { id: number; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    let alive = true;
    blobUrl(photoPath(id)).then((x) => { u = x; if (alive) setSrc(x); else URL.revokeObjectURL(x); }).catch(() => undefined);
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return src ? <img src={src} alt={alt} className={className} /> : <span className={`photo-loading ${className ?? ''}`} />;
}
