import { useLocation, useNavigate } from 'react-router-dom';

/** Tillbaka i historiken, eller till fallback om sidan öppnades direkt. */
export function useBack(fallback = '/recept') {
  const nav = useNavigate();
  const loc = useLocation();
  return () => (loc.key !== 'default' ? nav(-1) : nav(fallback, { replace: true }));
}
