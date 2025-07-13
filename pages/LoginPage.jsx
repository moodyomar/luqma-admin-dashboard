import { useState } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../src/contexts/AuthContext';
import brandConfig from '../constants/brandConfig';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { userRole, authError, logout, loading } = useAuth();

  // Professional, efficient, scalable redirect based on role
  if (!loading && userRole === 'admin') {
    return <Navigate to="/meals" replace />;
  }
  if (!loading && userRole === 'driver') {
    return <Navigate to="/driver/orders" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation will be handled by role-based redirect above
    } catch (err) {
      setError('فشل تسجيل الدخول. يرجى التحقق من بيانات الدخول.');
    }
  };

  if (authError) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '18px',
        color: '#b71c1c',
        textAlign: 'center',
        padding: 24
      }}>
        <div style={{ marginBottom: 24 }}>
          ⚠️ {authError}
        </div>
        <button
          onClick={logout}
          style={{
            padding: '10px 24px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 16
          }}
        >
          تسجيل خروج | Logout
        </button>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      background: '#f9f9f9',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <div className="logo">
        <img src={brandConfig.logoUrl} alt={brandConfig.name} />
      </div>
      <div style={{
        background: 'white',
        padding: 30,
        borderRadius: 10,
        boxShadow: '0 0 12px rgba(0,0,0,0.05)',
        width: 300,
        textAlign: 'center',
      }}>
        <h2 style={{ marginBottom: 20 }}>
          تسجيل الدخول | <strong>Login</strong>
        </h2>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="אימייל | الايميل"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 10 }}
          />
          <input
            type="password"
            placeholder="סיסמה | كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 10 }}
          />
          {error && <p style={{ color: 'red', fontSize: 14 }}>{error}</p>}
          <button type="submit" style={{
            width: '100%',
            background: brandConfig.themeColor,
            color: 'white',
            border: 'none',
            padding: '10px 0',
            borderRadius: 5,
            fontWeight: 'bold'
          }}>
            دخول | Login
          </button>
        </form>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 30,
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
      }}>
        Developed by <a href="https://qbmedia.co" target="_blank" rel="noreferrer" style={{ color: '#555', fontWeight: 500 }}>QB Media</a>
      </div>
    </div>
  );

};

export default LoginPage;
