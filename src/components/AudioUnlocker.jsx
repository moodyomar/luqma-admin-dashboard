import { useState } from 'react';
import brandConfig from '../../constants/brandConfig';

let sharedAudio = null;

export function getSharedAudio() {
  return sharedAudio;
}

export default function AudioUnlocker() {
  const [enabled, setEnabled] = useState(false);

  const handleClick = () => {
    const audio = new Audio(brandConfig.notificationSound);
    audio.muted = true;
    audio.volume = 0;

    audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        audio.volume = 1;

        sharedAudio = audio; // ✅ unlock + store for reuse
        setEnabled(true);
      })
      .catch(err => {
        console.warn('❌ Audio unlock failed', err);
      });
  };

  if (enabled) return null;

  return (
    <>
      {/* CSS Animation */}
      <style>
        {`
          @keyframes pulseButton {
            0% { 
              transform: scale(1);
              box-shadow: 0 4px 20px rgba(220, 53, 69, 0.4);
            }
            50% { 
              transform: scale(1.2);
              box-shadow: 0 8px 35px rgba(220, 53, 69, 0.7);
            }
            100% { 
              transform: scale(1);
              box-shadow: 0 4px 20px rgba(220, 53, 69, 0.4);
            }
          }
        `}
      </style>
      
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        textAlign: 'center'
      }}>
        <button 
          onClick={handleClick} 
          style={{ 
            fontSize: '18px', 
            padding: '15px 25px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '25px',
            fontWeight: 'bold',
            cursor: 'pointer',
            animation: 'pulseButton 2s ease-in-out infinite',
            transformOrigin: 'center'
          }}
        >
          🔊 تفعيل صوت التنبيه
        </button>
      </div>
    </>
  );
}
