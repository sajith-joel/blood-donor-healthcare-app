import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { db } from '../../services/firebaseConfig';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';

export default function RequestStatusScreen({ route, navigation }) {
  const { requestId } = route.params;
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Real-time listener for request updates
    const unsubscribe = onSnapshot(doc(db, 'bloodRequests', requestId), (doc) => {
      if (doc.exists()) {
        setRequest({ id: doc.id, ...doc.data() });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [requestId]);

  const updateRequestStatus = async (newStatus) => {
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'bloodRequests', requestId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      Alert.alert('Success', `Request marked as ${newStatus}`);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#4caf50';
      case 'fulfilled':
        return '#2196f3';
      case 'expired':
        return '#666';
      default:
        return '#ff9800';
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'emergency':
        return '#d32f2f';
      case 'high':
        return '#ff9800';
      default:
        return '#4caf50';
    }
  };

  if (loading) {
    return <Loader visible={true} />;
  }

  if (!request) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Request not found</Text>
      </View>
    );
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Request Status</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
          <Text style={styles.statusText}>{request.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Request Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Blood Group:</Text>
          <Text style={[styles.value, { fontWeight: 'bold', color: '#d32f2f' }]}>
            {request.bloodGroup}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Quantity:</Text>
          <Text style={styles.value}>{request.quantity} units</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Department:</Text>
          <Text style={styles.value}>{request.department || 'General'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Urgency:</Text>
          <Text style={[styles.value, { color: getUrgencyColor(request.urgency), fontWeight: 'bold' }]}>
            {request.urgency.toUpperCase()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Search Radius:</Text>
          <Text style={styles.value}>{request.radius} km</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Created:</Text>
          <Text style={styles.value}>{formatDate(request.createdAt)}</Text>
        </View>
        {request.patientName && (
          <View style={styles.detailRow}>
            <Text style={styles.label}>Patient:</Text>
            <Text style={styles.value}>{request.patientName}</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Responses ({request.responses?.length || 0})</Text>
        {request.responses && request.responses.length > 0 ? (
          request.responses.map((response, index) => (
            <View key={index} style={styles.responseItem}>
              <Text style={styles.responseText}>Donor responded: {response.response}</Text>
              <Text style={styles.responseTime}>{formatDate(response.timestamp)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No responses yet</Text>
        )}
      </View>

      {request.status === 'active' && (
        <View style={styles.buttonContainer}>
          <Button
            title="Mark as Fulfilled"
            onPress={() => updateRequestStatus('fulfilled')}
            loading={updating}
            style={styles.fulfillButton}
          />
          <Button
            title="Cancel Request"
            variant="outline"
            onPress={() => updateRequestStatus('cancelled')}
            loading={updating}
            style={styles.cancelButton}
          />
        </View>
      )}
    </ScrollView>
  );
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    width: 100,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  responseItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  responseText: {
    fontSize: 14,
    color: '#333',
  },
  responseTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  buttonContainer: {
    padding: 15,
    marginBottom: 30,
  },
  fulfillButton: {
    marginBottom: 10,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
  },
});