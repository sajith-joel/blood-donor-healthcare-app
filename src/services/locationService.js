import * as Location from 'expo-location';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

export const getCurrentLocation = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access location was denied');
    }

    const location = await Location.getCurrentPositionAsync({});
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    };
  } catch (error) {
    console.error('Error getting location:', error);
    throw error;
  }
};

export const updateDonorLocation = async (userId, location) => {
  try {
    await updateDoc(doc(db, 'donors', userId), {
      currentLocation: location,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating donor location:', error);
  }
};

export const getNearbyDonors = async (hospitalLocation, bloodGroup, radiusKm) => {
  try {
    const donorsRef = collection(db, 'donors');
    const q = query(donorsRef, where('bloodGroup', '==', bloodGroup));
    const querySnapshot = await getDocs(q);
    
    const nearbyDonors = [];
    querySnapshot.forEach((doc) => {
      const donor = doc.data();
      if (donor.currentLocation) {
        const distance = calculateDistance(
          hospitalLocation.latitude,
          hospitalLocation.longitude,
          donor.currentLocation.latitude,
          donor.currentLocation.longitude
        );
        
        if (distance <= radiusKm) {
          nearbyDonors.push({ id: doc.id, ...donor, distance });
        }
      }
    });
    
    return nearbyDonors.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error('Error getting nearby donors:', error);
    return [];
  }
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};