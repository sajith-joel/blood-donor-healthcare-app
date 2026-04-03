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
import { subscribeToActiveRequests, respondToRequest } from '../../services/bloodRequestService';
import { getCurrentLocation } from '../../services/locationService';
import { registerForPushNotifications } from '../../services/notificationService';
import BloodRequestCard from '../../components/donor/BloodRequestCard';

export default function DonorHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [userBloodGroup, setUserBloodGroup] = useState('');
  const [loading, setLoading] = useState(true);
  let unsubscribeRequests = null;

  useEffect(() => {
    loadUserData();
    setupNotifications();

    return () => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }
    };
  }, []);

  const loadUserData = async () => {
    try {
      const location = await getCurrentLocation();
      setUserLocation(location);
      
      // Get user blood group from database (you'll need to fetch this)
      // For now, let's assume it's set
      
      // Subscribe to real-time requests
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }
      
      unsubscribeRequests = subscribeToActiveRequests(
        location, 
        userBloodGroup || null, 
        (newRequests) => {
          setRequests(newRequests);
          setLoading(false);
        }
      );
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoading(false);
    }
  };

  const setupNotifications = async () => {
    await registerForPushNotifications(user.uid);
  };

  const handleRespond = async (request) => {
    Alert.alert(
      'Confirm Donation',
      `Do you want to donate ${request.bloodGroup} blood to ${request.hospitalName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, I Can Donate',
          onPress: async () => {
            const result = await respondToRequest(
              request.id, 
              user.uid, 
              user.displayName || 'Anonymous', 
              userBloodGroup
            );
            
            if (result.success) {
              Alert.alert('Success', 'Thank you! The hospital will contact you.');
            } else {
              Alert.alert('Error', result.error || 'Failed to respond');
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const location = await getCurrentLocation();
    setUserLocation(location);
    // The subscription will handle the refresh
    setRefreshing(false);
  };

  if (loading && requests.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading blood requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Blood Requests</Text>
        <Text style={styles.subtitle}>
          Showing requests within your blood group and location
        </Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BloodRequestCard
            request={item}
            onRespond={() => handleRespond(item)}
            showRespondButton={true}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No blood requests nearby</Text>
            <Text style={styles.emptySubtext}>
              Check back later or expand your search radius
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});