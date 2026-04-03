import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  orderBy,
  Timestamp,
  onSnapshot
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

  useEffect(() => {
    loadUserData();
    subscribeToRequests();
  }, []);

  const loadUserData = async () => {
    try {
      const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
      userDoc.forEach((doc) => {
        setUserData(doc.data());
      });
      
      const location = await getCurrentLocation();
      setUserLocation(location);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const subscribeToRequests = () => {
    const q = query(
      collection(db, 'bloodRequests'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, async (snapshot) => {
      const requestsList = [];
      const location = await getCurrentLocation().catch(() => null);
      
      for (const doc of snapshot.docs) {
        const request = doc.data();
        let include = true;
        
        // Filter by blood group compatibility
        if (userData?.bloodGroup) {
          const compatible = checkCompatibility(userData.bloodGroup, request.bloodGroup);
          if (!compatible) include = false;
        }
        
        // Filter by distance
        if (include && location && request.hospitalLocation) {
          const distance = calculateDistance(
            location.latitude,
            location.longitude,
            request.hospitalLocation.latitude,
            request.hospitalLocation.longitude
          );
          
          if (distance <= request.radius) {
            requestsList.push({ id: doc.id, ...request, distance });
          }
        } else if (include) {
          requestsList.push({ id: doc.id, ...request });
        }
      }
      
      setRequests(requestsList.sort((a, b) => (a.distance || 0) - (b.distance || 0)));
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
    Alert.alert(
      'Confirm Donation',
      `You are about to respond to a blood request from ${request.hospitalName}\n\nBlood Group: ${request.bloodGroup}\nDistance: ${request.distance?.toFixed(1)}km\nUrgency: ${request.urgency.toUpperCase()}\n\nDo you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, I Can Donate',
          onPress: async () => {
            try {
              const requestRef = doc(db, 'bloodRequests', request.id);
              const response = {
                donorId: user.uid,
                donorName: userData?.name || 'Anonymous',
                bloodGroup: userData?.bloodGroup,
                respondedAt: Timestamp.now(),
                phone: userData?.phone,
                status: 'pending'
              };
              
              await updateDoc(requestRef, {
                donorResponses: [...(request.donorResponses || []), response]
              });
              
              Alert.alert(
                'Response Sent!',
                `Thank you for your response!\n\n${request.hospitalName} will contact you soon at ${userData?.phone || 'your registered number'}.`
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

  const formatDistance = (distance) => {
    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    return `${distance.toFixed(1)}km away`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading blood requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🩸 Blood Requests Near You</Text>
        <Text style={styles.subtitle}>
          Showing compatible blood requests within {userData?.bloodGroup || 'your'} blood group
        </Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.requestCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.urgency) }]}>
                <Text style={styles.urgencyText}>{item.urgency.toUpperCase()}</Text>
              </View>
              {item.isRare && (
                <View style={styles.rareBadge}>
                  <Text style={styles.rareText}>⭐ RARE BLOOD</Text>
                </View>
              )}
            </View>

            <View style={styles.hospitalInfo}>
              <Icon name="local-hospital" size={20} color="#666" />
              <Text style={styles.hospitalName}>{item.hospitalName}</Text>
            </View>

            <View style={styles.bloodGroupContainer}>
              <View style={styles.bloodGroupCircle}>
                <Text style={styles.bloodGroupText}>{item.bloodGroup}</Text>
              </View>
              <View style={styles.requestDetails}>
                <Text style={styles.departmentText}>{item.department}</Text>
                <Text style={styles.quantityText}>Need {item.quantity} unit(s)</Text>
                {item.patientName && (
                  <Text style={styles.patientText}>Patient: {item.patientName}</Text>
                )}
              </View>
            </View>

            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Icon name="location-on" size={16} color="#666" />
                <Text style={styles.detailText}>
                  {item.distance ? formatDistance(item.distance) : 'Location available'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Icon name="access-time" size={16} color="#666" />
                <Text style={styles.detailText}>
                  {item.createdAt?.toDate().toLocaleString()}
                </Text>
              </View>
            </View>

            {item.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesText}>📝 {item.notes}</Text>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.respondButton, { backgroundColor: getUrgencyColor(item.urgency) }]}
              onPress={() => respondToRequest(item)}
            >
              <Icon name="favorite" size={20} color="#fff" />
              <Text style={styles.respondButtonText}>I Can Donate</Text>
            </TouchableOpacity>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="inbox" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No blood requests found</Text>
            <Text style={styles.emptySubtext}>
              Check back later or expand your search radius
            </Text>
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#d32f2f' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 5 },
  requestCard: { backgroundColor: '#fff', margin: 15, padding: 15, borderRadius: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  urgencyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  urgencyText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  rareBadge: { backgroundColor: '#ff9800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  rareText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  hospitalInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  hospitalName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginLeft: 8 },
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
  notesText: { fontSize: 12, color: '#666' },
  respondButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 8 },
  respondButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  emptyContainer: { alignItems: 'center', padding: 50 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#999', marginTop: 10 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5, textAlign: 'center' }
});