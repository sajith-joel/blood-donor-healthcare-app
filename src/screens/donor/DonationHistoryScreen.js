import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl
} from 'react-native';
import { db } from '../../services/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import Loader from '../../components/common/Loader';

export default function DonationHistoryScreen() {
  const { user } = useAuth();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDonationHistory();
  }, []);

  const loadDonationHistory = async () => {
    try {
      const donationsRef = collection(db, 'donations');
      const q = query(
        donationsRef,
        where('donorId', '==', user.uid),
        orderBy('donatedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const donationsList = [];
      querySnapshot.forEach((doc) => {
        donationsList.push({ id: doc.id, ...doc.data() });
      });
      setDonations(donationsList);
    } catch (error) {
      console.error('Error loading donation history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDonationHistory();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#4caf50';
      case 'pending':
        return '#ff9800';
      case 'cancelled':
        return '#d32f2f';
      default:
        return '#666';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderDonationCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.hospitalName}>{item.hospitalName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.details}>
        <Text style={styles.detailText}>🩸 Blood Group: {item.bloodGroup}</Text>
        <Text style={styles.detailText}>💉 Units Donated: {item.units}</Text>
        <Text style={styles.detailText}>📅 Date: {formatDate(item.donatedAt)}</Text>
        {item.notes && (
          <Text style={styles.notesText}>📝 Notes: {item.notes}</Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return <Loader visible={true} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Donation History</Text>
        <Text style={styles.subtitle}>
          Total Donations: {donations.length}
        </Text>
      </View>

      <FlatList
        data={donations}
        keyExtractor={(item) => item.id}
        renderItem={renderDonationCard}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No donation history</Text>
            <Text style={styles.emptySubtext}>
              Your donation history will appear here
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
    backgroundColor: '#fff',
    padding: 20,
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
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  details: {
    marginTop: 5,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 2,
  },
  notesText: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
    fontStyle: 'italic',
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