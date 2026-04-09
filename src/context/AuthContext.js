import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, db } from '../services/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState(null);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    // Check if user was remembered
    checkRememberMe();
    
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserType(userDoc.data().userType);
        }
        setUser(user);
      } else {
        setUser(null);
        setUserType(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const checkRememberMe = async () => {
    try {
      const remembered = await AsyncStorage.getItem('rememberMe');
      if (remembered === 'true') {
        // User wanted to stay logged in
        await setPersistence(auth, browserLocalPersistence);
      } else {
        await setPersistence(auth, browserSessionPersistence);
      }
    } catch (error) {
      console.error('Error checking remember me:', error);
    }
  };

  const register = async (email, password, userData, remember = false) => {
    try {
      // Set persistence based on remember me
      if (remember) {
        await setPersistence(auth, browserLocalPersistence);
        await AsyncStorage.setItem('rememberMe', 'true');
      } else {
        await setPersistence(auth, browserSessionPersistence);
        await AsyncStorage.setItem('rememberMe', 'false');
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        ...userData,
        uid: userCredential.user.uid,
        email: email,
        createdAt: new Date().toISOString(),
        isActive: true
      });
      
      if (userData.userType === 'donor') {
        await setDoc(doc(db, 'donors', userCredential.user.uid), {
          uid: userCredential.user.uid,
          bloodGroup: userData.bloodGroup,
          isAvailable: true,
          totalDonations: 0,
          locationEnabled: false,
          createdAt: new Date().toISOString()
        });
      }
      
      if (userData.userType === 'hospital') {
        await setDoc(doc(db, 'hospitals', userCredential.user.uid), {
          uid: userCredential.user.uid,
          hospitalName: userData.name,
          address: userData.address || '',
          verified: false,
          totalRequests: 0,
          activeRequests: 0,
          createdAt: new Date().toISOString()
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  };

  const login = async (email, password, remember = false) => {
    try {
      // Set persistence based on remember me
      if (remember) {
        await setPersistence(auth, browserLocalPersistence);
        await AsyncStorage.setItem('rememberMe', 'true');
      } else {
        await setPersistence(auth, browserSessionPersistence);
        await AsyncStorage.setItem('rememberMe', 'false');
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        await updateDoc(doc(db, 'users', userCredential.user.uid), {
          lastLogin: new Date().toISOString()
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          isActive: false,
          lastLogout: new Date().toISOString()
        }).catch(() => {});
      }
      
      // Clear remember me on logout
      await AsyncStorage.removeItem('rememberMe');
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, userType, rememberMe, setRememberMe,
      register, login, logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};