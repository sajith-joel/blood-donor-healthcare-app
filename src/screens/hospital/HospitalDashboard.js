import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { subscribeToHospitalRequests, updateRequestStatus } from '../../services/bloodRequestService';
import { getCurrentLocation } from '../../services/locationService';
import RequestForm from '../../components/hospital/RequestForm';
import BloodRequestCard from '../../components/donor/BloodRequestCard';

export default function HospitalDashboard({ navigation }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hospitalLocation, setHospitalLocation] = useState(null);
  let unsubscribeRequests = null;

  useEffect(() => {
    loadHospitalLocation();
    
    // Subscribe to real-time requests
    unsubscribeRequests = subscribeToHospitalRequests(user.uid, (newRequests) => {
      setRequests(newRequests);
    });

    return () => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }
    };
  }, []);

  const loadHospitalLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setHospitalLocation(location);
    } catch (error) {
      console.error('Error loading location:', error);
    }
  };

  const handleCreateRequest = async (requestData) => {
    try {
      const result = await createBloodRequest({
        ...requestData,
        hospitalId: user.uid,
        hospitalName: user.displayName || 'Hospital',
        hospitalLocation
      });
      
      if (result.success) {
        Alert.alert('Success', 'Blood request created successfully!');
        setShowRequestForm(false);
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create blood request');
    }
  };

  const handleUpdateStatus = async (requestId, status, donorId = null) => {
    Alert.alert(
      'Update Request',
      `Mark this request as ${status}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const result = await updateRequestStatus(requestId, status, donorId);
            if (result.success) {
              Alert.alert('Success', `Request marked as ${status}`);
            } else {
              Alert.alert('Error', result.error);
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHospitalLocation();
    setRefreshing(false);
  };

  const activeRequests = requests.filter(r => r.status === 'active');
  const fulfilledRequests = requests.filter(r => r.status === 'fulfilled');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hospital Dashboard</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowRequestForm(true)}
        >
          <Text style={styles.createButtonText}>+ New Request</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{activeRequests.length}</Text>
          <Text style={styles.statLabel}>Active Requests</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {activeRequests.filter(r => r.isRare).length}
          </Text>
          <Text style={styles.statLabel}>Rare Blood Requests</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{fulfilledRequests.length}</Text>
          <Text style={styles.statLabel}>Fulfilled</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Active Requests</Text>
      <FlatList
        data={activeRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BloodRequestCard
            request={item}
            onPress={() => navigation.navigate('RequestStatus', { requestId: item.id })}
            footerText={`${item.donorResponses?.length || 0} donor(s) responded`}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No active requests</Text>
            <Text style={styles.emptySubtext}>
              Tap "New Request" to create one
            </Text>
          </View>
        }
      />

      {showRequestForm && (
        <RequestForm
          onSubmit={handleCreateRequest}
          onClose={() => setShowRequestForm(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  createButton: {
    backgroundColor: '#d32f2f',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'space-around',
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#d32f2f',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
});