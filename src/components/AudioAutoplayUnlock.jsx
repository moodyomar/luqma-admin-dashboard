import { useEffect, useRef } from 'react';
import brandConfig from '../../constants/brandConfig';

/**
 * Luqma admin dashboard — source for MenuAppTemplate/Dashboard-reactjs via sync-template.sh.
 * Browsers block notification audio until a user gesture. On first click, touch, or
 * keydown we play brandConfig.notificationSound muted once, then detach listeners so
 * OrdersPage Firestore-driven new Audio(...).play() calls work.
 */
export default function AudioAutoplayUnlock() {
  const unlocked = useRef(false);

  useEffect(() => {
    let cleaned = false;
    const opts = { capture: true, passive: true };

    const removeAll = () => {
      document.documentElement.removeEventListener('click', onGesture, opts);
      document.documentElement.removeEventListener('touchstart', onGesture, opts);
      document.documentElement.removeEventListener('keydown', onGesture, opts);
    };

    const onGesture = () => {
      if (unlocked.current || cleaned) return;
      const audio = new Audio(brandConfig.notificationSound);
      audio.muted = true;
      audio.volume = 0;
      audio
        .play()
        .then(() => {
          if (cleaned) return;
          unlocked.current = true;
          audio.pause();
          audio.currentTime = 0;
          removeAll();
        })
        .catch(() => {});
    };

    document.documentElement.addEventListener('click', onGesture, opts);
    document.documentElement.addEventListener('touchstart', onGesture, opts);
    document.documentElement.addEventListener('keydown', onGesture, opts);

    return () => {
      cleaned = true;
      removeAll();
    };
  }, []);

  return null;
}
