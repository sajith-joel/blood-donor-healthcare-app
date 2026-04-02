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
  deleteDoc
} from 'firebase/firestore';
import { sendBulkNotifications } from './notificationService';

const RARE_BLOOD_GROUPS = ['AB-', 'B-', 'A-', 'O-'];

export const createBloodRequest = async (requestData) => {
  try {
    const isRare = RARE_BLOOD_GROUPS.includes(requestData.bloodGroup);
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
    await updateDoc(hospitalRef, {
      totalRequests: (await getDoc(hospitalRef)).data()?.totalRequests + 1 || 1,
      activeRequests: (await getDoc(hospitalRef)).data()?.activeRequests + 1 || 1
    });
    
    // Get nearby donors
    const nearbyDonors = await getNearbyDonors(
      requestData.hospitalLocation,
      requestData.bloodGroup,
      radius
    );
    
    // Send notifications to nearby donors
    let notificationResults = [];
    if (nearbyDonors.length > 0) {
      notificationResults = await sendBulkNotifications(nearbyDonors, {
        requestId: docRef.id,
        bloodGroup: requestData.bloodGroup,
        hospitalName: requestData.hospitalName,
        urgency: requestData.urgency
      });
    }
    
    return { 
      success: true, 
      requestId: docRef.id, 
      nearbyDonorsCount: nearbyDonors.length,
      notificationsSent: notificationResults.filter(r => r.success).length
    };
  } catch (error) {
    console.error('Error creating blood request:', error);
    return { success: false, error: error.message };
  }
};

export const getNearbyDonors = async (hospitalLocation, bloodGroup, radiusKm) => {
  try {
    const donorsRef = collection(db, 'donors');
    const q = query(donorsRef, where('bloodGroup', '==', bloodGroup), where('isAvailable', '==', true));
    const querySnapshot = await getDocs(q);
    
    const nearbyDonors = [];
    for (const doc of querySnapshot.docs) {
      const donor = doc.data();
      const userDoc = await getDoc(doc(db, 'users', donor.uid));
      const userData = userDoc.data();
      
      if (donor.currentLocation && donor.locationEnabled) {
        const distance = calculateDistance(
          hospitalLocation.latitude,
          hospitalLocation.longitude,
          donor.currentLocation.latitude,
          donor.currentLocation.longitude
        );
        
        if (distance <= radiusKm) {
          nearbyDonors.push({ 
            id: doc.id, 
            ...donor, 
            ...userData,
            distance 
          });
        }
      }
    }
    
    return nearbyDonors.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error('Error getting nearby donors:', error);
    return [];
  }
};

export const getActiveRequests = async (userLocation, bloodGroup = null, radius = null) => {
  try {
    const requestsRef = collection(db, 'bloodRequests');
    const q = query(
      requestsRef, 
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const requests = [];
    
    for (const doc of querySnapshot.docs) {
      const request = doc.data();
      let shouldInclude = true;
      
      if (bloodGroup && request.bloodGroup !== bloodGroup) {
        shouldInclude = false;
      }
      
      if (shouldInclude && userLocation) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          request.hospitalLocation.latitude,
          request.hospitalLocation.longitude
        );
        
        const maxRadius = radius || request.radius;
        if (distance <= maxRadius) {
          requests.push({ id: doc.id, ...request, distance });
        }
      } else if (shouldInclude) {
        requests.push({ id: doc.id, ...request });
      }
    }
    
    return requests.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  } catch (error) {
    console.error('Error getting active requests:', error);
    return [];
  }
};

export const respondToRequest = async (requestId, donorId, responseData) => {
  try {
    const requestRef = doc(db, 'bloodRequests', requestId);
    const requestDoc = await getDoc(requestRef);
    
    if (!requestDoc.exists()) {
      return { success: false, error: 'Request not found' };
    }
    
    const response = {
      donorId,
      response: responseData.message || 'I can donate',
      timestamp: Timestamp.now(),
      status: 'pending'
    };
    
    await updateDoc(requestRef, {
      donorResponses: arrayUnion(response)
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error responding to request:', error);
    return { success: false, error: error.message };
  }
};

export const updateRequestStatus = async (requestId, status, donorId = null) => {
  try {
    const requestRef = doc(db, 'bloodRequests', requestId);
    const updates = { status, updatedAt: Timestamp.now() };
    
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
      await updateDoc(userRef, {
        totalDonations: (await getDoc(userRef)).data()?.totalDonations + 1 || 1,
        lastDonation: Timestamp.now()
      });
    }
    
    if (status === 'fulfilled' || status === 'cancelled') {
      const request = await getDoc(requestRef);
      const hospitalRef = doc(db, 'hospitals', request.data().hospitalId);
      await updateDoc(hospitalRef, {
        activeRequests: (await getDoc(hospitalRef)).data()?.activeRequests - 1 || 0
      });
    }
    
    await updateDoc(requestRef, updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating request status:', error);
    return { success: false, error: error.message };
  }
};

export const getHospitalRequests = async (hospitalId, status = null) => {
  try {
    let q;
    if (status) {
      q = query(
        collection(db, 'bloodRequests'),
        where('hospitalId', '==', hospitalId),
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'bloodRequests'),
        where('hospitalId', '==', hospitalId),
        orderBy('createdAt', 'desc')
      );
    }
    
    const querySnapshot = await getDocs(q);
    const requests = [];
    querySnapshot.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() });
    });
    
    return requests;
  } catch (error) {
    console.error('Error getting hospital requests:', error);
    return [];
  }
};

export const getDonorHistory = async (donorId) => {
  try {
    const q = query(
      collection(db, 'bloodRequests'),
      where('fulfilledBy', '==', donorId),
      orderBy('fulfilledAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const donations = [];
    querySnapshot.forEach((doc) => {
      donations.push({ id: doc.id, ...doc.data() });
    });
    
    return donations;
  } catch (error) {
    console.error('Error getting donor history:', error);
    return [];
  }
};

export const deleteExpiredRequests = async () => {
  try {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    const q = query(
      collection(db, 'bloodRequests'),
      where('createdAt', '<', Timestamp.fromDate(twentyFourHoursAgo)),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    const batch = db.batch();
    
    querySnapshot.forEach((doc) => {
      batch.update(doc.ref, { status: 'expired' });
    });
    
    await batch.commit();
    return { success: true, count: querySnapshot.size };
  } catch (error) {
    console.error('Error deleting expired requests:', error);
    return { success: false, error: error.message };
  }
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};