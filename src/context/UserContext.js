import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUserData(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  return (
    <UserContext.Provider value={{ userData, loading }}>
      {children}
    </UserContext.Provider>
  );
};