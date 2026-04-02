import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

export const registerUser = async (email, password, userData) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update profile with display name
    await updateProfile(user, {
      displayName: userData.name
    });
    
    // Save user data to Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: email,
      name: userData.name,
      phone: userData.phone,
      bloodGroup: userData.bloodGroup || null,
      userType: userData.userType,
      createdAt: new Date().toISOString(),
      isActive: true,
      totalDonations: 0,
      lastDonation: null
    });
    
    // If donor, create donor specific document
    if (userData.userType === 'donor') {
      await setDoc(doc(db, 'donors', user.uid), {
        uid: user.uid,
        bloodGroup: userData.bloodGroup,
        isAvailable: true,
        totalDonations: 0,
        lastDonationDate: null,
        locationEnabled: false,
        currentLocation: null
      });
    }
    
    // If hospital, create hospital specific document
    if (userData.userType === 'hospital') {
      await setDoc(doc(db, 'hospitals', user.uid), {
        uid: user.uid,
        hospitalName: userData.hospitalName || userData.name,
        address: userData.address || '',
        verified: false,
        totalRequests: 0,
        activeRequests: 0
      });
    }
    
    return { success: true, user: user };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: error.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user type from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      return { 
        success: true, 
        user: user, 
        userType: userDoc.data().userType 
      };
    } else {
      return { success: false, error: 'User data not found' };
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
};

export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, error: error.message };
  }
};

export const updateUserProfile = async (userId, userData) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, userData);
    return { success: true };
  } catch (error) {
    console.error('Profile update error:', error);
    return { success: false, error: error.message };
  }
};

export const getUserData = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() };
    } else {
      return { success: false, error: 'User not found' };
    }
  } catch (error) {
    console.error('Get user data error:', error);
    return { success: false, error: error.message };
  }
};