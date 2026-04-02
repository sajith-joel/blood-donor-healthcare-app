import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { UserProvider } from './src/context/UserContext';
import AppNavigator from './src/navigation/AppNavigator';
import { LogBox, StatusBar } from 'react-native';

LogBox.ignoreLogs([
  'Warning: ...',
  'Setting a timer',
  'AsyncStorage has been extracted from react-native core',
]);

export default function App() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AuthProvider>
        <UserProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </UserProvider>
      </AuthProvider>
    </>
  );
}