import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import AuthLandingScreen from './AuthLandingScreen';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';

export default function AuthScreen() {
  const [mode, setMode] = useState('landing');
  const isLanding = mode === 'landing';

  return (
    <SafeAreaView
      style={[styles.safeArea, isLanding && styles.safeAreaLanding]}
      edges={isLanding ? ['left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      {mode === 'forgot' ? (
        <ForgotPasswordScreen
          onBack={() => setMode('login')}
          onSuccess={() => setMode('login')}
        />
      ) : mode === 'register' ? (
        <RegisterScreen
          onGoBack={() => setMode('landing')}
          onGoLogin={() => setMode('login')}
        />
      ) : mode === 'login' ? (
        <LoginScreen
          onGoForgot={() => setMode('forgot')}
          onGoBack={() => setMode('landing')}
        />
      ) : (
        <AuthLandingScreen
          onGoLogin={() => setMode('login')}
          onGoRegister={() => setMode('register')}
        />
      )}
    </SafeAreaView>
  );
}

const styles = {
  safeArea: {
    flex: 1,
    backgroundColor: '#e7f0ed',
  },
  safeAreaLanding: {
    backgroundColor: '#e8f6ec',
  },
};
