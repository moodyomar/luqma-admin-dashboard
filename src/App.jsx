import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import '../src/styles/admin.css'

function App() {
  const navigate = useNavigate();
  const { user, userRole, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect based on user role
        if (userRole === 'driver') {
          navigate('/driver/orders');
        } else if (userRole === 'admin') {
          navigate('/meals');
        } else {
          // Default to admin if role is not set
          navigate('/meals');
        }
      } else {
        navigate('/login');
      }
    }
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        fontSize: '18px',
        color: '#666'
      }}>
        جاري التحميل... | Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Redirecting...</h2>
    </div>
  );
}

export default App;
