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

export default function NearbyRequestScreen({ navigation }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterBloodGroup, setFilterBloodGroup] = useState(null);
  const [userData, setUserData] = useState(null);
  let unsubscribeRequests = null;

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  useEffect(() => {
    loadUserData();
    
    return () => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }
    };
  }, [filterBloodGroup]);

  const loadUserData = async () => {
    try {
      // Get user data from users collection
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('uid', '==', user.uid));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.forEach((doc) => {
          setUserData(doc.data());
        });
      });
      
      // Setup requests listener after getting user data
      setupRequestsListener();
      
      return unsubscribe;
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoading(false);
    }
  };

  const setupRequestsListener = async () => {
    if (unsubscribeRequests) {
      unsubscribeRequests();
    }

    try {
      const location = await getCurrentLocation();
      
      const requestsRef = collection(db, 'bloodRequests');
      const q = query(
        requestsRef,
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      );

      unsubscribeRequests = onSnapshot(q, (snapshot) => {
        console.log(`Found ${snapshot.size} active requests`);
        
        const requestsList = [];
        
        snapshot.forEach((docSnapshot) => {
          const request = docSnapshot.data();
          const requestId = docSnapshot.id;
          
          // Filter by blood group if selected
          if (filterBloodGroup && request.bloodGroup !== filterBloodGroup) {
            return;
          }
          
          // Check blood group compatibility with user
          if (userData?.bloodGroup) {
            const isCompatible = checkCompatibility(userData.bloodGroup, request.bloodGroup);
            if (!isCompatible) return;
          }
          
          // Calculate distance
          let distance = null;
          if (location && request.hospitalLocation) {
            distance = calculateDistance(
              location.latitude,
              location.longitude,
              request.hospitalLocation.latitude,
              request.hospitalLocation.longitude
            );
            
            // Check if within radius
            if (distance > request.radius) return;
          }
          
          requestsList.push({
            id: requestId,
            ...request,
            distance: distance
          });
        });
        
        // Sort by distance (closest first)
        requestsList.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        setRequests(requestsList);
        setLoading(false);
        setRefreshing(false);
      }, (error) => {
        console.error('Error in real-time listener:', error);
        setLoading(false);
        setRefreshing(false);
      });
    } catch (error) {
      console.error('Error setting up listener:', error);
      setLoading(false);
    }
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

    const donorDetails = {
      donorId: user.uid,
      donorName: userData?.name || 'Anonymous Donor',
      bloodGroup: userData?.bloodGroup,
      phone: userData?.phone,
      email: user?.email,
      respondedAt: Timestamp.now(),
      status: 'pending'
    };
    
    Alert.alert(
      'Confirm Donation',
      `Do you want to donate ${request.bloodGroup} blood to ${request.hospitalName}?\n\nYour details will be shared with the hospital.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, I Can Donate',
          onPress: async () => {
            try {
              const requestRef = doc(db, 'bloodRequests', request.id);
              const existingResponses = request.donorResponses || [];
              
              const alreadyResponded = existingResponses.some(r => r.donorId === user.uid);
              if (alreadyResponded) {
                Alert.alert('Already Responded', 'You have already responded to this request.');
                return;
              }
              
              await updateDoc(requestRef, {
                donorResponses: [...existingResponses, donorDetails],
                lastResponseAt: Timestamp.now()
              });
              
              Alert.alert(
                'Response Sent!', 
                `Thank you! ${request.hospitalName} will contact you at ${userData.phone}`
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
    if (!distance) return 'Distance unknown';
    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    return `${distance.toFixed(1)}km away`;
  };

  const onRefresh = () => {
    setRefreshing(true);
    setupRequestsListener();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#d32f2f" />
        <Text style={styles.loadingText}>Loading nearby requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filter by Blood Group:</Text>
        <FlatList
          horizontal
          data={bloodGroups}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterBloodGroup === item && styles.activeFilter
              ]}
              onPress={() => setFilterBloodGroup(filterBloodGroup === item ? null : item)}
            >
              <Text style={[
                styles.filterText,
                filterBloodGroup === item && styles.activeFilterText
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
        />
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
                  <Text style={styles.rareText}>⭐ RARE</Text>
                </View>
              )}
            </View>

            <View style={styles.hospitalInfo}>
              <Icon name="local-hospital" size={20} color="#d32f2f" />
              <Text style={styles.hospitalName}>{item.hospitalName}</Text>
            </View>

            <View style={styles.bloodGroupCircle}>
              <Text style={styles.bloodGroupText}>{item.bloodGroup}</Text>
            </View>

            <View style={styles.requestDetails}>
              <Text style={styles.departmentText}>{item.department || 'Blood Bank'}</Text>
              <Text style={styles.quantityText}>Need {item.quantity} unit(s)</Text>
              <Text style={styles.detailText}>{formatDistance(item.distance)}</Text>
              <Text style={styles.radiusText}>Search radius: {item.radius}km</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="inbox" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No blood requests found</Text>
            <Text style={styles.emptySubtext}>
              {filterBloodGroup 
                ? `No ${filterBloodGroup} blood requests nearby` 
                : 'No active blood requests in your area'}
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  activeFilter: {
    backgroundColor: '#d32f2f',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterText: {
    color: '#fff',
  },
  requestCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  rareBadge: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rareText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  hospitalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  bloodGroupCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#d32f2f',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  bloodGroupText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  requestDetails: {
    marginBottom: 15,
  },
  departmentText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  quantityText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  radiusText: {
    fontSize: 11,
    color: '#4caf50',
  },
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  respondButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
});