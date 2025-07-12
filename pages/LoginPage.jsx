import { useState } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import brandConfig from '../constants/brandConfig';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/meals');
    } catch (err) {
      setError('Login failed. Check your credentials.');
    }
  };
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

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  marginBottom: '15px',
  borderRadius: '6px',
  border: '1px solid #ccc',
};

const buttonStyle = {
  width: '100%',
  padding: '12px',
  backgroundColor: '#28a745',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
};
