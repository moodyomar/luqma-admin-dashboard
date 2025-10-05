import { useState } from 'react';

let sharedAudio = null;

export function getSharedAudio() {
  return sharedAudio;
}

export default function AudioUnlocker() {
  const [enabled, setEnabled] = useState(false);

  const handleClick = () => {
    const audio = new Audio('/luqma.mp3');
    audio.play()
      .then(() => {
        sharedAudio = audio; // ✅ unlock + store for reuse
        setEnabled(true);
      })
      .catch(err => {
        console.warn('❌ Audio unlock failed', err);
      });
  };

  if (enabled) return null;

  return (
    <div style={{ textAlign: 'center', marginTop: 20 }}>
      <button onClick={handleClick} style={{ fontSize: 16, padding: 10 }}>
        🔊 تفعيل صوت التنبيه
      </button>
    </div>
  );
}
