import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, db } from '../services/firebaseConfig';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState(null);

  useEffect(() => {
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

  const register = async (email, password, userData) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Save user data
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        ...userData,
        uid: userCredential.user.uid,
        email: email,
        createdAt: new Date().toISOString(),
        isActive: true
      });
      
      // If donor, create donor document
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
      
      // If hospital, create hospital document
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

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        // Update last login
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
      // Update user status before logout
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          isActive: false,
          lastLogout: new Date().toISOString()
        }).catch(() => {});
      }
      
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, userType, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};