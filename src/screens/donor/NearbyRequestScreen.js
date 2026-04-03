import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { getActiveRequests } from '../../services/bloodRequestService';
import { getCurrentLocation } from '../../services/locationService';
import BloodRequestCard from '../../components/donor/BloodRequestCard';
import Loader from '../../components/common/Loader';

export default function NearbyRequestScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterBloodGroup, setFilterBloodGroup] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  useEffect(() => {
    loadRequests();
  }, [filterBloodGroup]);

  const loadRequests = async () => {
    try {
      const location = await getCurrentLocation();
      setUserLocation(location);
      // Using getActiveRequests function
      const nearbyRequests = await getActiveRequests(location, filterBloodGroup);
      setRequests(nearbyRequests);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  if (loading) {
    return <Loader visible={true} />;
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
          <BloodRequestCard
            request={item}
            onRespond={() => navigation.navigate('RespondToRequest', { request: item })}
            showRespondButton={true}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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