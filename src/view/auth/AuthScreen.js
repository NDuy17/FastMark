import { useState } from 'react';

import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';

export default function AuthScreen() {
  const [mode, setMode] = useState('login');

  if (mode === 'forgot') {
    return (
      <ForgotPasswordScreen
        onBack={() => setMode('login')}
        onSuccess={() => setMode('login')}
      />
    );
  }

  if (mode === 'register') {
    return (
      <RegisterScreen
        onGoBack={() => setMode('login')}
        onGoLogin={() => setMode('login')}
      />
    );
  }

  return <LoginScreen onGoRegister={() => setMode('register')} onGoForgot={() => setMode('forgot')} />;
}
