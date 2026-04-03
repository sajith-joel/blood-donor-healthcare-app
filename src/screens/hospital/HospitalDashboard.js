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
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebaseConfig';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  updateDoc, 
  doc,
  orderBy,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { getCurrentLocation } from '../../services/locationService';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function HospitalDashboard({ navigation }) {
  const { user, logout } = useAuth();
  const [requests, setRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hospitalLocation, setHospitalLocation] = useState(null);
  const [loading, setLoading] = useState(true);
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
    if (user?.uid) {
      loadHospitalLocation();
      subscribeToRequests();
    }
  }, [user?.uid]);

  const loadHospitalLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setHospitalLocation(location);
    } catch (error) {
      console.error('Error loading location:', error);
    }
  };

  const subscribeToRequests = () => {
    if (!user?.uid) return;
    
    const q = query(
      collection(db, 'bloodRequests'),
      where('hospitalId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const requestsList = [];
      snapshot.forEach((doc) => {
        requestsList.push({ id: doc.id, ...doc.data() });
      });
      setRequests(requestsList);
      setLoading(false);
    }, (error) => {
      console.error('Error:', error);
      setLoading(false);
    });
  };

  const createBloodRequest = async () => {
    console.log('Create button pressed');
    console.log('Form data:', formData);
    
    if (!formData.bloodGroup) {
      Alert.alert('Error', 'Please select blood group');
      return;
    }

    if (!hospitalLocation) {
      Alert.alert('Error', 'Unable to get your location. Please enable location services.');
      return;
    }

    const isRare = ['AB-', 'B-', 'A-', 'O-'].includes(formData.bloodGroup);
    const radius = isRare ? 5 : 3;

    setLoading(true);

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
        hospitalLocation: {
          latitude: hospitalLocation.latitude,
          longitude: hospitalLocation.longitude
        },
        donorResponses: []
      };

      console.log('Creating request:', requestData);
      await addDoc(collection(db, 'bloodRequests'), requestData);
      
      Alert.alert('Success', `Blood request created! Searching within ${radius}km`);
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
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to create request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (requestId, newStatus) => {
    console.log('Updating request:', requestId, 'to', newStatus);
    try {
      const requestRef = doc(db, 'bloodRequests', requestId);
      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      Alert.alert('Success', `Request marked as ${newStatus}`);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to update request');
    }
  };

  const handleLogout = () => {
    console.log('Logout button pressed');
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            console.log('Logging out...');
            await logout();
          }
        }
      ]
    );
  };

  const activeRequests = requests.filter(r => r.status === 'active');
  const fulfilledRequests = requests.filter(r => r.status === 'fulfilled');

  if (loading && requests.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#d32f2f" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🏥 Hospital Dashboard</Text>
          <Text style={styles.subtitle}>Welcome, {user?.displayName || 'Hospital'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Icon name="logout" size={24} color="#d32f2f" />
        </TouchableOpacity>
      </View>

      {/* Stats - Make New Request card clickable */}
      <View style={styles.statsContainer}>
        <TouchableOpacity style={styles.statCard} onPress={() => setShowRequestForm(true)}>
          <Icon name="add-circle" size={40} color="#d32f2f" />
          <Text style={styles.statLabel}>New Request</Text>
        </TouchableOpacity>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{activeRequests.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
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
          <View style={styles.requestCard}>
            <View style={styles.bloodGroupCircle}>
              <Text style={styles.bloodGroupText}>{item.bloodGroup}</Text>
            </View>
            <View style={styles.requestInfo}>
              <Text style={styles.departmentText}>{item.department}</Text>
              <Text style={styles.quantityText}>Need {item.quantity} unit(s)</Text>
              <Text style={styles.urgencyText}>Urgency: {item.urgency}</Text>
              <Text style={styles.responseCount}>
                {item.donorResponses?.length || 0} donor(s) responded
              </Text>
            </View>
            <View style={styles.buttonGroup}>
              <TouchableOpacity 
                style={styles.fulfillButton}
                onPress={() => updateRequestStatus(item.id, 'fulfilled')}
              >
                <Text style={styles.buttonText}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => updateRequestStatus(item.id, 'cancelled')}
              >
                <Text style={styles.buttonText}>✗</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No active requests</Text>
            <TouchableOpacity style={styles.createButtonLarge} onPress={() => setShowRequestForm(true)}>
              <Text style={styles.createButtonText}>+ Create Request</Text>
            </TouchableOpacity>
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
                    <Text style={styles.bloodGroupOptionText}>{group}</Text>
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
                placeholder="e.g., Emergency, ICU"
              />

              <Text style={styles.inputLabel}>Urgency Level</Text>
              <View style={styles.urgencyContainer}>
                {urgencyLevels.map(level => (
                  <TouchableOpacity
                    key={level.value}
                    style={[styles.urgencyOption, { backgroundColor: level.color }]}
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#d32f2f' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  logoutButton: { padding: 8 },
  statsContainer: { flexDirection: 'row', padding: 15, justifyContent: 'space-around' },
  statCard: { backgroundColor: '#fff', padding: 15, borderRadius: 10, alignItems: 'center', minWidth: 100, elevation: 2 },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: '#d32f2f' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginLeft: 15, marginTop: 10 },
  requestCard: { flexDirection: 'row', backgroundColor: '#fff', margin: 15, marginTop: 8, padding: 15, borderRadius: 12, alignItems: 'center', elevation: 2 },
  bloodGroupCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#d32f2f', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  bloodGroupText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  requestInfo: { flex: 1 },
  departmentText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  quantityText: { fontSize: 12, color: '#666' },
  urgencyText: { fontSize: 12, color: '#ff9800', marginTop: 2 },
  responseCount: { fontSize: 11, color: '#4caf50', marginTop: 2 },
  buttonGroup: { flexDirection: 'row', gap: 8 },
  fulfillButton: { backgroundColor: '#4caf50', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cancelButton: { backgroundColor: '#d32f2f', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', padding: 50 },
  emptyText: { fontSize: 16, color: '#999' },
  createButtonLarge: { backgroundColor: '#d32f2f', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, marginTop: 15 },
  createButtonText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalContainer: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#d32f2f' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 15, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  textArea: { height: 80, textAlignVertical: 'top' },
  bloodGroupGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  bloodGroupOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f0f0f0', margin: 4 },
  bloodGroupSelected: { backgroundColor: '#d32f2f' },
  bloodGroupOptionText: { fontSize: 14, color: '#333' },
  urgencyContainer: { flexDirection: 'row', gap: 10 },
  urgencyOption: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  urgencyOptionText: { color: '#fff', fontWeight: 'bold' },
  submitButton: { backgroundColor: '#d32f2f', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});