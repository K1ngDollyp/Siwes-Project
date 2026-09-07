import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('login'); // 'login' | 'register' | 'chat'

  useEffect(() => {
    const storedUser = localStorage.getItem('chat_user');
    const storedToken = localStorage.getItem('chat_token');

    if (storedUser && storedToken) {
      try {
        setCurrentUser(JSON.parse(storedUser));
        setView('chat');
      } catch (err) {
        localStorage.removeItem('chat_user');
        localStorage.removeItem('chat_token');
      }
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setView('chat');
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_user');
    localStorage.removeItem('chat_token');
    setCurrentUser(null);
    setView('login');
  };

  if (view === 'chat' && currentUser) {
    return <Chat currentUser={currentUser} onLogout={handleLogout} />;
  }

  if (view === 'register') {
    return (
      <Register
        switchToLogin={() => setView('login')}
        onRegisterSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <Login
      onLoginSuccess={handleLoginSuccess}
      switchToRegister={() => setView('register')}
    />
  );
}
