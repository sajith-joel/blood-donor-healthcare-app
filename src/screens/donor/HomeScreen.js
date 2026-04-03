import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  doc,
  updateDoc
} from 'firebase/firestore';
import { getCurrentLocation } from '../../services/locationService';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function DonorHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  let unsubscribeRequests = null;

  useEffect(() => {
    initializeDonor();
    
    // Cleanup subscription on unmount
    return () => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }
    };
  }, []);

  const initializeDonor = async () => {
    await loadUserData();
    await setupRealTimeListener();
  };

  const loadUserData = async () => {
    try {
      // Query to get user data
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('uid', '==', user.uid));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.forEach((doc) => {
          setUserData(doc.data());
        });
      });
      
      // Get current location
      const location = await getCurrentLocation();
      setUserLocation(location);
      
      return unsubscribe;
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const setupRealTimeListener = async () => {
    if (unsubscribeRequests) {
      unsubscribeRequests();
    }

    // Query for active blood requests
    const requestsRef = collection(db, 'bloodRequests');
    const q = query(
      requestsRef,
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    unsubscribeRequests = onSnapshot(q, async (snapshot) => {
      console.log(`Found ${snapshot.size} active requests`);
      
      const requestsList = [];
      const location = await getCurrentLocation().catch(() => null);
      
      for (const docSnapshot of snapshot.docs) {
        const request = docSnapshot.data();
        const requestId = docSnapshot.id;
        
        // Check if blood group is compatible
        let isCompatible = false;
        if (userData?.bloodGroup) {
          isCompatible = checkCompatibility(userData.bloodGroup, request.bloodGroup);
        } else {
          isCompatible = true; // If no blood group set, show all
        }
        
        if (!isCompatible) continue;
        
        // Calculate distance if location available
        let distance = null;
        let isWithinRadius = true;
        
        if (location && request.hospitalLocation) {
          distance = calculateDistance(
            location.latitude,
            location.longitude,
            request.hospitalLocation.latitude,
            request.hospitalLocation.longitude
          );
          isWithinRadius = distance <= request.radius;
        }
        
        if (isWithinRadius) {
          requestsList.push({
            id: requestId,
            ...request,
            distance: distance
          });
        }
      }
      
      // Sort by distance (closest first)
      requestsList.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
      setRequests(requestsList);
      setLoading(false);
    }, (error) => {
      console.error('Error in real-time listener:', error);
      setLoading(false);
    });
  };

  const checkCompatibility = (donorBlood, recipientBlood) => {
    const compatibility = {
      'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
      'O+': ['O+', 'A+', 'B+', 'AB+'],
      'A-': ['A-', 'A+', 'AB-', 'AB+'],
      'A+': ['A+', 'AB+'],
      'B-': ['B-', 'B+', 'AB-', 'AB+'],
      'B+': ['B+', 'AB+'],
      'AB-': ['AB-', 'AB+'],
      'AB+': ['AB+']
    };
    return compatibility[donorBlood]?.includes(recipientBlood) || false;
  };

  const respondToRequest = async (request) => {
    if (!userData?.phone) {
      Alert.alert(
        'Phone Number Required',
        'Please update your profile with a phone number so the hospital can contact you.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Update Now', onPress: () => navigation.navigate('Profile') }
        ]
      );
      return;
    }

    Alert.alert(
      'Confirm Donation',
      `You are about to respond to a blood request:\n\n` +
      `🏥 Hospital: ${request.hospitalName}\n` +
      `🩸 Blood Group: ${request.bloodGroup}\n` +
      `📍 Distance: ${request.distance ? request.distance.toFixed(1) : 'Unknown'}km\n` +
      `⚠️ Urgency: ${request.urgency.toUpperCase()}\n` +
      `📞 Contact: ${userData.phone}\n\n` +
      `The hospital will contact you at this number. Do you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, I Can Donate',
          onPress: async () => {
            try {
              const requestRef = doc(db, 'bloodRequests', request.id);
              const response = {
                donorId: user.uid,
                donorName: userData?.name || 'Anonymous Donor',
                bloodGroup: userData?.bloodGroup,
                phone: userData?.phone,
                respondedAt: Timestamp.now(),
                status: 'pending',
                message: `Donor responded to ${request.bloodGroup} blood request`
              };
              
              // Get existing responses
              const existingResponses = request.donorResponses || [];
              
              // Check if already responded
              const alreadyResponded = existingResponses.some(r => r.donorId === user.uid);
              if (alreadyResponded) {
                Alert.alert('Already Responded', 'You have already responded to this request.');
                return;
              }
              
              // Update the request with new response
              await updateDoc(requestRef, {
                donorResponses: [...existingResponses, response],
                lastResponseAt: Timestamp.now()
              });
              
              Alert.alert(
                'Response Sent! 🩸',
                `Thank you for your willingness to donate!\n\n` +
                `${request.hospitalName} will contact you shortly at ${userData.phone}.\n\n` +
                `You are helping save a life!`
              );
            } catch (error) {
              console.error('Error responding:', error);
              Alert.alert('Error', 'Failed to send response. Please try again.');
            }
          }
        }
      ]
    );
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'emergency': return '#d32f2f';
      case 'high': return '#ff9800';
      default: return '#4caf50';
    }
  };

  const getUrgencyIcon = (urgency) => {
    switch (urgency) {
      case 'emergency': return '🚨';
      case 'high': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const formatDistance = (distance) => {
    if (!distance) return 'Distance unknown';
    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    return `${distance.toFixed(1)}km away`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = Math.floor((now - date) / 60000);
    
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} minutes ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#d32f2f" />
        <Text style={styles.loadingText}>Loading blood requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🩸 Blood Requests Near You</Text>
        <Text style={styles.subtitle}>
          {userData?.bloodGroup 
            ? `Showing compatible requests for ${userData.bloodGroup} blood type`
            : 'Please update your blood group in profile'}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statText}>{requests.length} active requests</Text>
          </View>
          {userData?.bloodGroup && (
            <View style={styles.bloodGroupBadge}>
              <Text style={styles.bloodGroupBadgeText}>Your blood: {userData.bloodGroup}</Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.requestCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.urgency) }]}>
                <Text style={styles.urgencyText}>
                  {getUrgencyIcon(item.urgency)} {item.urgency.toUpperCase()}
                </Text>
              </View>
              {item.isRare && (
                <View style={styles.rareBadge}>
                  <Text style={styles.rareText}>⭐ RARE BLOOD</Text>
                </View>
              )}
              <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
            </View>

            <View style={styles.hospitalInfo}>
              <Icon name="local-hospital" size={20} color="#d32f2f" />
              <Text style={styles.hospitalName}>{item.hospitalName}</Text>
            </View>

            <View style={styles.bloodGroupContainer}>
              <View style={styles.bloodGroupCircle}>
                <Text style={styles.bloodGroupText}>{item.bloodGroup}</Text>
              </View>
              <View style={styles.requestDetails}>
                <Text style={styles.departmentText}>{item.department || 'Blood Bank'}</Text>
                <Text style={styles.quantityText}>Need {item.quantity} unit(s)</Text>
                {item.patientName && (
                  <Text style={styles.patientText}>Patient: {item.patientName}</Text>
                )}
              </View>
            </View>

            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Icon name="location-on" size={16} color="#666" />
                <Text style={styles.detailText}>{formatDistance(item.distance)}</Text>
              </View>
              <View style={styles.detailItem}>
                <Icon name="search" size={16} color="#666" />
                <Text style={styles.detailText}>Search radius: {item.radius}km</Text>
              </View>
            </View>

            {item.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>📝 Hospital Notes:</Text>
                <Text style={styles.notesText}>{item.notes}</Text>
              </View>
            )}

            <View style={styles.responseInfo}>
              <Icon name="people" size={14} color="#999" />
              <Text style={styles.responseText}>
                {item.donorResponses?.length || 0} donor(s) have responded
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.respondButton, { backgroundColor: getUrgencyColor(item.urgency) }]}
              onPress={() => respondToRequest(item)}
            >
              <Icon name="favorite" size={20} color="#fff" />
              <Text style={styles.respondButtonText}>I Can Donate</Text>
            </TouchableOpacity>
          </View>
        )}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              await setupRealTimeListener();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="inbox" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No blood requests found</Text>
            <Text style={styles.emptySubtext}>
              {userData?.bloodGroup 
                ? `No active ${userData.bloodGroup} blood requests within your area`
                : 'Please update your blood group in profile to see relevant requests'}
            </Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={() => setupRealTimeListener()}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 10, fontSize: 14, color: '#666' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#d32f2f' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 5 },
  statsRow: { flexDirection: 'row', marginTop: 10, gap: 10 },
  statBadge: { backgroundColor: '#d32f2f', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  bloodGroupBadge: { backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  bloodGroupBadgeText: { color: '#666', fontSize: 12 },
  requestCard: { backgroundColor: '#fff', margin: 15, padding: 15, borderRadius: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  urgencyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  urgencyText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  rareBadge: { backgroundColor: '#ff9800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  rareText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  timeText: { fontSize: 10, color: '#999' },
  hospitalInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  hospitalName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginLeft: 8, flex: 1 },
  bloodGroupContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  bloodGroupCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#d32f2f', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  bloodGroupText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  requestDetails: { flex: 1 },
  departmentText: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  quantityText: { fontSize: 12, color: '#666', marginTop: 2 },
  patientText: { fontSize: 12, color: '#999', marginTop: 2 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center' },
  detailText: { fontSize: 12, color: '#666', marginLeft: 4 },
  notesContainer: { backgroundColor: '#f5f5f5', padding: 10, borderRadius: 8, marginBottom: 12 },
  notesLabel: { fontSize: 11, fontWeight: 'bold', color: '#666', marginBottom: 4 },
  notesText: { fontSize: 12, color: '#666' },
  responseInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  responseText: { fontSize: 11, color: '#999', marginLeft: 6 },
  respondButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 8 },
  respondButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  emptyContainer: { alignItems: 'center', padding: 50 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#999', marginTop: 10 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5, textAlign: 'center' },
  refreshButton: { marginTop: 20, backgroundColor: '#d32f2f', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 },
  refreshButtonText: { color: '#fff', fontWeight: 'bold' }
});