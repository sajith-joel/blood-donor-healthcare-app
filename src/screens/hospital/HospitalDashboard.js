import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  TextInput
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebaseConfig';
import { 
  collection, 
  addDoc, 
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

export default function HospitalDashboard({ navigation }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hospitalLocation, setHospitalLocation] = useState(null);
  const [formData, setFormData] = useState({
    bloodGroup: '',
    quantity: '1',
    department: 'Emergency',
    urgency: 'normal',
    patientName: '',
    patientAge: '',
    notes: ''
  });

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const urgencyLevels = [
    { value: 'normal', label: 'Normal', color: '#4caf50' },
    { value: 'high', label: 'High', color: '#ff9800' },
    { value: 'emergency', label: 'Emergency', color: '#d32f2f' }
  ];

  useEffect(() => {
    loadHospitalLocation();
    subscribeToRequests();
  }, []);

  const loadHospitalLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setHospitalLocation(location);
    } catch (error) {
      console.error('Error loading location:', error);
    }
  };

  const subscribeToRequests = () => {
    const q = query(
      collection(db, 'bloodRequests'),
      where('hospitalId', '==', user?.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const requestsList = [];
      snapshot.forEach((doc) => {
        requestsList.push({ id: doc.id, ...doc.data() });
      });
      setRequests(requestsList);
    });
  };

  const createBloodRequest = async () => {
    if (!formData.bloodGroup) {
      Alert.alert('Error', 'Please select blood group');
      return;
    }

    const isRare = ['AB-', 'B-', 'A-', 'O-'].includes(formData.bloodGroup);
    const radius = isRare ? 5 : 3;

    try {
      const requestData = {
        hospitalId: user.uid,
        hospitalName: user.displayName || 'City Hospital',
        bloodGroup: formData.bloodGroup,
        quantity: parseInt(formData.quantity),
        department: formData.department,
        urgency: formData.urgency,
        patientName: formData.patientName,
        patientAge: formData.patientAge,
        notes: formData.notes,
        status: 'active',
        radius: radius,
        isRare: isRare,
        createdAt: Timestamp.now(),
        hospitalLocation: hospitalLocation,
        donorResponses: [],
        fulfilledBy: null,
        fulfilledAt: null
      };

      await addDoc(collection(db, 'bloodRequests'), requestData);
      
      Alert.alert('Success', `Blood request created! Searching within ${radius}km radius`);
      setShowRequestForm(false);
      setFormData({
        bloodGroup: '',
        quantity: '1',
        department: 'Emergency',
        urgency: 'normal',
        patientName: '',
        patientAge: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error creating request:', error);
      Alert.alert('Error', 'Failed to create blood request');
    }
  };

  const updateRequestStatus = async (requestId, newStatus, donorId = null) => {
    try {
      const requestRef = doc(db, 'bloodRequests', requestId);
      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: Timestamp.now(),
        ...(donorId && { fulfilledBy: donorId, fulfilledAt: Timestamp.now() })
      });
      Alert.alert('Success', `Request marked as ${newStatus}`);
    } catch (error) {
      console.error('Error updating request:', error);
      Alert.alert('Error', 'Failed to update request');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'fulfilled': return '#2196f3';
      case 'cancelled': return '#d32f2f';
      default: return '#666';
    }
  };

  const activeRequests = requests.filter(r => r.status === 'active');
  const fulfilledRequests = requests.filter(r => r.status === 'fulfilled');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Hospital Dashboard</Text>
          <Text style={styles.subtitle}>Manage blood requests</Text>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={() => setShowRequestForm(true)}>
          <Icon name="add" size={24} color="#fff" />
          <Text style={styles.createButtonText}>New Request</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{activeRequests.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{fulfilledRequests.length}</Text>
          <Text style={styles.statLabel}>Fulfilled</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {activeRequests.filter(r => r.isRare).length}
          </Text>
          <Text style={styles.statLabel}>Rare Blood</Text>
        </View>
      </View>

      {/* Active Requests List */}
      <FlatList
        data={activeRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <View style={[styles.urgencyBadge, { backgroundColor: urgencyLevels.find(u => u.value === item.urgency)?.color }]}>
                <Text style={styles.urgencyText}>{item.urgency.toUpperCase()}</Text>
              </View>
              {item.isRare && (
                <View style={styles.rareBadge}>
                  <Text style={styles.rareText}>⭐ RARE</Text>
                </View>
              )}
            </View>

            <View style={styles.bloodGroupSection}>
              <View style={styles.bloodGroupCircle}>
                <Text style={styles.bloodGroupText}>{item.bloodGroup}</Text>
              </View>
              <View style={styles.requestInfo}>
                <Text style={styles.departmentText}>{item.department}</Text>
                <Text style={styles.quantityText}>Need {item.quantity} unit(s)</Text>
                {item.patientName && (
                  <Text style={styles.patientText}>Patient: {item.patientName}</Text>
                )}
              </View>
            </View>

            <View style={styles.donorResponses}>
              <Text style={styles.responsesTitle}>
                🤝 Donor Responses ({item.donorResponses?.length || 0})
              </Text>
              {item.donorResponses?.slice(0, 3).map((response, idx) => (
                <View key={idx} style={styles.responseItem}>
                  <Text style={styles.responseText}>🩸 {response.donorName} - {response.bloodGroup}</Text>
                  <Text style={styles.responseTime}>
                    {response.respondedAt?.toDate().toLocaleTimeString()}
                  </Text>
                </View>
              ))}
              {(item.donorResponses?.length || 0) > 3 && (
                <Text style={styles.moreText}>+{item.donorResponses.length - 3} more</Text>
              )}
            </View>

            <View style={styles.requestFooter}>
              <Text style={styles.timeText}>
                {item.createdAt?.toDate().toLocaleString()}
              </Text>
              <View style={styles.actionButtons}>
                {item.status === 'active' && (
                  <>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.fulfillButton]}
                      onPress={() => updateRequestStatus(item.id, 'fulfilled')}
                    >
                      <Text style={styles.actionButtonText}>Mark Fulfilled</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={() => updateRequestStatus(item.id, 'cancelled')}
                    >
                      <Text style={styles.actionButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadHospitalLocation} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="inbox" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No active requests</Text>
            <Text style={styles.emptySubtext}>Tap "New Request" to create one</Text>
          </View>
        }
      />

      {/* Create Request Modal */}
      <Modal visible={showRequestForm} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Blood Request</Text>
              <TouchableOpacity onPress={() => setShowRequestForm(false)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Blood Group *</Text>
              <View style={styles.bloodGroupGrid}>
                {bloodGroups.map(group => (
                  <TouchableOpacity
                    key={group}
                    style={[styles.bloodGroupOption, formData.bloodGroup === group && styles.bloodGroupSelected]}
                    onPress={() => setFormData({...formData, bloodGroup: group})}
                  >
                    <Text style={[styles.bloodGroupOptionText, formData.bloodGroup === group && styles.bloodGroupSelectedText]}>
                      {group}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Quantity (units)</Text>
              <TextInput
                style={styles.input}
                value={formData.quantity}
                onChangeText={(text) => setFormData({...formData, quantity: text})}
                keyboardType="numeric"
                placeholder="Number of units needed"
              />

              <Text style={styles.inputLabel}>Department</Text>
              <TextInput
                style={styles.input}
                value={formData.department}
                onChangeText={(text) => setFormData({...formData, department: text})}
                placeholder="e.g., Emergency, ICU, Surgery"
              />

              <Text style={styles.inputLabel}>Urgency Level</Text>
              <View style={styles.urgencyContainer}>
                {urgencyLevels.map(level => (
                  <TouchableOpacity
                    key={level.value}
                    style={[styles.urgencyOption, { backgroundColor: level.color }, formData.urgency === level.value && styles.urgencySelected]}
                    onPress={() => setFormData({...formData, urgency: level.value})}
                  >
                    <Text style={styles.urgencyOptionText}>{level.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Patient Name (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.patientName}
                onChangeText={(text) => setFormData({...formData, patientName: text})}
                placeholder="Patient name"
              />

              <Text style={styles.inputLabel}>Patient Age (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.patientAge}
                onChangeText={(text) => setFormData({...formData, patientAge: text})}
                placeholder="Patient age"
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Additional Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData({...formData, notes: text})}
                placeholder="Any special requirements..."
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity style={styles.submitButton} onPress={createBloodRequest}>
                <Text style={styles.submitButtonText}>Create Request</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#d32f2f' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  createButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#d32f2f', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  createButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 4 },
  statsContainer: { flexDirection: 'row', padding: 15, justifyContent: 'space-around' },
  statCard: { backgroundColor: '#fff', padding: 15, borderRadius: 10, alignItems: 'center', minWidth: 100, elevation: 2 },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: '#d32f2f' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 5 },
  requestCard: { backgroundColor: '#fff', margin: 15, padding: 15, borderRadius: 12, elevation: 2 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  urgencyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  urgencyText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  rareBadge: { backgroundColor: '#ff9800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  rareText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  bloodGroupSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  bloodGroupCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#d32f2f', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  bloodGroupText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  requestInfo: { flex: 1 },
  departmentText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  quantityText: { fontSize: 14, color: '#666', marginTop: 2 },
  patientText: { fontSize: 12, color: '#999', marginTop: 2 },
  donorResponses: { backgroundColor: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 12 },
  responsesTitle: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 8 },
  responseItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  responseText: { fontSize: 12, color: '#333' },
  responseTime: { fontSize: 10, color: '#999' },
  moreText: { fontSize: 10, color: '#999', marginTop: 4 },
  requestFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 12 },
  timeText: { fontSize: 10, color: '#999' },
  actionButtons: { flexDirection: 'row' },
  actionButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
  fulfillButton: { backgroundColor: '#4caf50' },
  cancelButton: { backgroundColor: '#d32f2f' },
  actionButtonText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', padding: 50 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 10 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalContainer: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#d32f2f' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 15, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  bloodGroupGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  bloodGroupOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f0f0f0', margin: 4 },
  bloodGroupSelected: { backgroundColor: '#d32f2f' },
  bloodGroupOptionText: { fontSize: 14, color: '#333' },
  bloodGroupSelectedText: { color: '#fff' },
  urgencyContainer: { flexDirection: 'row', gap: 10 },
  urgencyOption: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  urgencySelected: { borderWidth: 2, borderColor: '#333' },
  urgencyOptionText: { color: '#fff', fontWeight: 'bold' },
  submitButton: { backgroundColor: '#d32f2f', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 10 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});