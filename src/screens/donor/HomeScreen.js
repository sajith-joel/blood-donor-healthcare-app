import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getActiveRequests } from '../../services/bloodRequestService';
import { getCurrentLocation } from '../../services/locationService';
import { registerForPushNotifications } from '../../services/notificationService';
import BloodRequestCard from '../../components/donor/BloodRequestCard';

export default function DonorHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [userBloodGroup, setUserBloodGroup] = useState('');

  useEffect(() => {
    loadUserData();
    setupNotifications();
  }, []);

  const loadUserData = async () => {
    try {
      const location = await getCurrentLocation();
      setUserLocation(location);
      // Get user blood group from database
      // setUserBloodGroup(userData.bloodGroup);
      loadNearbyRequests(location);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const setupNotifications = async () => {
    await registerForPushNotifications(user.uid);
  };

  const loadNearbyRequests = async (location) => {
    try {
      const nearbyRequests = await getActiveRequests(location, userBloodGroup);
      setRequests(nearbyRequests);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const location = await getCurrentLocation();
    await loadNearbyRequests(location);
    setRefreshing(false);
  };

  const handleRespond = (request) => {
    navigation.navigate('RespondToRequest', { request });
  };

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
});