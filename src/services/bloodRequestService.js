import { db } from './firebaseConfig';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  orderBy,
  Timestamp,
  getDoc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';

// Create blood request
export const createBloodRequest = async (requestData) => {
  try {
    const isRare = ['AB-', 'B-', 'A-', 'O-'].includes(requestData.bloodGroup);
    const radius = isRare ? 5 : 3;
    
    const request = {
      ...requestData,
      radius,
      isRare,
      status: 'active',
      createdAt: Timestamp.now(),
      responses: [],
      donorResponses: []
    };
    
    const docRef = await addDoc(collection(db, 'bloodRequests'), request);
    
    // Update hospital statistics
    const hospitalRef = doc(db, 'hospitals', requestData.hospitalId);
    const hospitalDoc = await getDoc(hospitalRef);
    if (hospitalDoc.exists()) {
      await updateDoc(hospitalRef, {
        totalRequests: (hospitalDoc.data().totalRequests || 0) + 1,
        activeRequests: (hospitalDoc.data().activeRequests || 0) + 1
      });
    }
    
    return { 
      success: true, 
      requestId: docRef.id
    };
  } catch (error) {
    console.error('Error creating blood request:', error);
    return { success: false, error: error.message };
  }
};

// Get active requests with real-time listener
export const subscribeToActiveRequests = (userLocation, bloodGroup, callback) => {
  const q = query(
    collection(db, 'bloodRequests'),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const requests = [];
    snapshot.forEach((doc) => {
      const request = doc.data();
      let shouldInclude = true;
      
      if (bloodGroup && request.bloodGroup !== bloodGroup) {
        shouldInclude = false;
      }
      
      if (shouldInclude && userLocation) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          request.hospitalLocation?.latitude || 0,
          request.hospitalLocation?.longitude || 0
        );
        
        const maxRadius = request.radius || 3;
        if (distance <= maxRadius) {
          requests.push({ id: doc.id, ...request, distance });
        }
      } else if (shouldInclude) {
        requests.push({ id: doc.id, ...request });
      }
    });
    
    callback(requests.sort((a, b) => (a.distance || 0) - (b.distance || 0)));
  });
};

// Respond to blood request
export const respondToRequest = async (requestId, donorId, donorName, bloodGroup) => {
  try {
    const requestRef = doc(db, 'bloodRequests', requestId);
    const requestDoc = await getDoc(requestRef);
    
    if (!requestDoc.exists()) {
      return { success: false, error: 'Request not found' };
    }
    
    const request = requestDoc.data();
    
    // Check if donor already responded
    const alreadyResponded = request.donorResponses?.some(r => r.donorId === donorId);
    if (alreadyResponded) {
      return { success: false, error: 'You have already responded to this request' };
    }
    
    const response = {
      donorId,
      donorName,
      bloodGroup,
      respondedAt: Timestamp.now(),
      status: 'pending'
    };
    
    await updateDoc(requestRef, {
      donorResponses: [...(request.donorResponses || []), response]
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error responding to request:', error);
    return { success: false, error: error.message };
  }
};

// Update request status
export const updateRequestStatus = async (requestId, status, donorId = null) => {
  try {
    const requestRef = doc(db, 'bloodRequests', requestId);
    const updates = { 
      status, 
      updatedAt: Timestamp.now() 
    };
    
    if (status === 'fulfilled' && donorId) {
      updates.fulfilledBy = donorId;
      updates.fulfilledAt = Timestamp.now();
      
      // Update donor statistics
      const donorRef = doc(db, 'donors', donorId);
      const donorDoc = await getDoc(donorRef);
      if (donorDoc.exists()) {
        await updateDoc(donorRef, {
          totalDonations: (donorDoc.data().totalDonations || 0) + 1,
          lastDonationDate: Timestamp.now()
        });
      }
      
      // Update user statistics
      const userRef = doc(db, 'users', donorId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        await updateDoc(userRef, {
          totalDonations: (userDoc.data().totalDonations || 0) + 1,
          lastDonation: Timestamp.now()
        });
      }
    }
    
    await updateDoc(requestRef, updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating request status:', error);
    return { success: false, error: error.message };
  }
};

// Subscribe to hospital requests
export const subscribeToHospitalRequests = (hospitalId, callback) => {
  const q = query(
    collection(db, 'bloodRequests'),
    where('hospitalId', '==', hospitalId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const requests = [];
    snapshot.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() });
    });
    callback(requests);
  });
};

// Calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}