import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/firebaseConfig';

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect user based on login state
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        navigate('/meals');
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div style={{ padding: 40 }}>
      <h2>Redirecting...</h2>
    </div>
  );
}

export default App;
