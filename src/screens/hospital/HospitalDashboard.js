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
  onSnapshot,
  getDocs,
  setDoc
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
      console.log('=== HOSPITAL DASHBOARD INITIALIZED ===');
      console.log('User ID:', user.uid);
      console.log('User Email:', user.email);
      console.log('User Display Name:', user.displayName);
      loadHospitalLocation();
      checkFirestoreConnection();
      subscribeToRequests();
    } else {
      console.log('No user found - please login as hospital');
      setLoading(false);
    }
  }, [user?.uid]);

  const checkFirestoreConnection = async () => {
    try {
      console.log('Checking Firestore connection...');
      const testRef = collection(db, 'bloodRequests');
      const testQuery = await getDocs(testRef);
      console.log('Firestore connection successful! Total requests in DB:', testQuery.size);
    } catch (error) {
      console.error('Firestore connection error:', error);
      Alert.alert('Database Error', 'Cannot connect to Firebase. Please check your internet connection.');
    }
  };

  const loadHospitalLocation = async () => {
    try {
      console.log('Loading hospital location...');
      const location = await getCurrentLocation();
      console.log('Hospital location loaded:', location);
      setHospitalLocation(location);
    } catch (error) {
      console.error('Error loading location:', error);
      Alert.alert('Location Error', 'Please enable location services to create blood requests.');
    }
  };

  const subscribeToRequests = () => {
    if (!user?.uid) {
      console.log('No user ID, cannot subscribe');
      return;
    }
    
    console.log('Setting up real-time listener for hospital ID:', user.uid);
    
    const q = query(
      collection(db, 'bloodRequests'),
      where('hospitalId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log('=== REAL-TIME UPDATE RECEIVED ===');
        console.log('Total requests in snapshot:', snapshot.size);
        const requestsList = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log(`Request ID: ${doc.id}, Blood: ${data.bloodGroup}, Status: ${data.status}, Quantity: ${data.quantity}`);
          requestsList.push({ id: doc.id, ...data });
        });
        setRequests(requestsList);
        setLoading(false);
      },
      (error) => {
        console.error('Error in snapshot listener:', error);
        Alert.alert('Firestore Error', error.message);
        setLoading(false);
      }
    );
    
    return unsubscribe;
  };

  const createBloodRequest = async () => {
    console.log('=== CREATE BLOOD REQUEST ===');
    console.log('Form data:', JSON.stringify(formData, null, 2));
    
    // Validate form
    if (!formData.bloodGroup) {
      Alert.alert('Error', 'Please select blood group');
      return;
    }

    if (!hospitalLocation) {
      Alert.alert('Error', 'Unable to get your location. Please enable location services.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'User not authenticated. Please login again.');
      return;
    }

    const isRare = ['AB-', 'B-', 'A-', 'O-'].includes(formData.bloodGroup);
    const radius = isRare ? 5 : 3;

    setLoading(true);

    try {
      const requestData = {
        hospitalId: user.uid,
        hospitalName: user.displayName || 'City Hospital',
        hospitalEmail: user.email,
        bloodGroup: formData.bloodGroup,
        quantity: parseInt(formData.quantity),
        department: formData.department,
        urgency: formData.urgency,
        patientName: formData.patientName || '',
        patientAge: formData.patientAge || '',
        notes: formData.notes || '',
        status: 'active',
        radius: radius,
        isRare: isRare,
        createdAt: Timestamp.now(),
        hospitalLocation: {
          latitude: hospitalLocation.latitude,
          longitude: hospitalLocation.longitude
        },
        donorResponses: [],
        createdAtDate: new Date().toISOString()
      };

      console.log('Sending data to Firestore:', JSON.stringify(requestData, null, 2));
      
      const docRef = await addDoc(collection(db, 'bloodRequests'), requestData);
      
      console.log('✅ SUCCESS! Request created with ID:', docRef.id);
      
      // Verify the request was added
      const verifyDoc = await getDocs(query(collection(db, 'bloodRequests'), where('hospitalId', '==', user.uid)));
      console.log('Total requests after creation:', verifyDoc.size);
      
      Alert.alert(
        '✅ Success!', 
        `Blood request created successfully!\n\n` +
        `Blood Group: ${formData.bloodGroup}\n` +
        `Quantity: ${formData.quantity} units\n` +
        `Department: ${formData.department}\n` +
        `Urgency: ${formData.urgency.toUpperCase()}\n` +
        `Search Radius: ${radius}km\n\n` +
        `Donors will be notified immediately.`
      );
      
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
      console.error('❌ Error creating request:', error);
      Alert.alert('Error', 'Failed to create blood request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (requestId, newStatus) => {
    console.log(`Updating request ${requestId} to status: ${newStatus}`);
    try {
      const requestRef = doc(db, 'bloodRequests', requestId);
      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: Timestamp.now(),
        updatedAtDate: new Date().toISOString()
      });
      console.log(`✅ Request ${requestId} updated to ${newStatus}`);
      Alert.alert('Success', `Request marked as ${newStatus}`);
    } catch (error) {
      console.error('Error updating request:', error);
      Alert.alert('Error', 'Failed to update request: ' + error.message);
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
        <Text style={styles.loadingSubText}>Make sure you're logged in as a hospital</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🏥 Hospital Dashboard</Text>
          <Text style={styles.subtitle}>Welcome, {user?.displayName || user?.email || 'Hospital'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Icon name="logout" size={24} color="#d32f2f" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
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

      <Text style={styles.sectionTitle}>Active Requests ({activeRequests.length})</Text>
      <FlatList
        data={activeRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <View style={styles.bloodGroupCircle}>
                <Text style={styles.bloodGroupText}>{item.bloodGroup}</Text>
              </View>
              <View style={styles.urgencyBadgeContainer}>
                <View style={[styles.urgencyBadge, { backgroundColor: urgencyLevels.find(u => u.value === item.urgency)?.color || '#4caf50' }]}>
                  <Text style={styles.urgencyText}>{item.urgency.toUpperCase()}</Text>
                </View>
                {item.isRare && (
                  <View style={styles.rareBadge}>
                    <Text style={styles.rareText}>⭐ RARE</Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={styles.requestInfo}>
              <Text style={styles.departmentText}>{item.department || 'Blood Bank'}</Text>
              <Text style={styles.quantityText}>📊 Need {item.quantity} unit(s)</Text>
              <Text style={styles.radiusText}>📍 Search radius: {item.radius}km</Text>
              <Text style={styles.responseCount}>
                👥 {item.donorResponses?.length || 0} donor(s) responded
              </Text>
              {item.donorResponses && item.donorResponses.length > 0 && (
                <View style={styles.responseList}>
                  <Text style={styles.responseListTitle}>Recent responses:</Text>
                  {item.donorResponses.slice(0, 2).map((response, idx) => (
                    <Text key={idx} style={styles.responseItem}>
                      🩸 {response.donorName} - {response.bloodGroup} 📞 {response.phone}
                    </Text>
                  ))}
                </View>
              )}
              {item.patientName ? (
                <Text style={styles.patientText}>👤 Patient: {item.patientName}</Text>
              ) : null}
            </View>
            
            <View style={styles.buttonGroup}>
              <TouchableOpacity 
                style={styles.fulfillButton}
                onPress={() => updateRequestStatus(item.id, 'fulfilled')}
              >
                <Text style={styles.buttonText}>✓ Mark Fulfilled</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => updateRequestStatus(item.id, 'cancelled')}
              >
                <Text style={styles.buttonText}>✗ Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              setRefreshing(true);
              subscribeToRequests();
              setTimeout(() => setRefreshing(false), 1000);
            }} 
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="inbox" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No active requests</Text>
            <Text style={styles.emptySubtext}>Tap "New Request" to create one</Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={() => {
                console.log('Manual refresh triggered');
                subscribeToRequests();
                Alert.alert('Refreshed', 'Checking for existing requests...');
              }}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
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
                    <Text style={[styles.bloodGroupOptionText, formData.bloodGroup === group && styles.bloodGroupSelectedText]}>
                      {group}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Quantity (units) *</Text>
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

              <Text style={styles.inputLabel}>Urgency Level *</Text>
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

              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={createBloodRequest}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Request</Text>
                )}
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 10, fontSize: 14, color: '#666' },
  loadingSubText: { marginTop: 5, fontSize: 12, color: '#999' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#d32f2f' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  logoutButton: { padding: 8 },
  statsContainer: { flexDirection: 'row', padding: 15, justifyContent: 'space-around' },
  statCard: { backgroundColor: '#fff', padding: 15, borderRadius: 10, alignItems: 'center', minWidth: 100, elevation: 2 },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: '#d32f2f' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginLeft: 15, marginTop: 10, marginBottom: 5 },
  requestCard: { backgroundColor: '#fff', margin: 15, marginTop: 8, padding: 15, borderRadius: 12, elevation: 2 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bloodGroupCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#d32f2f', justifyContent: 'center', alignItems: 'center' },
  bloodGroupText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  urgencyBadgeContainer: { flexDirection: 'row', gap: 8 },
  urgencyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  urgencyText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  rareBadge: { backgroundColor: '#ff9800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  rareText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  requestInfo: { marginBottom: 12 },
  departmentText: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  quantityText: { fontSize: 14, color: '#666', marginBottom: 2 },
  radiusText: { fontSize: 12, color: '#4caf50', marginBottom: 2 },
  responseCount: { fontSize: 12, color: '#2196f3', marginBottom: 4, fontWeight: '500' },
  responseList: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  responseListTitle: { fontSize: 11, fontWeight: 'bold', color: '#666', marginBottom: 4 },
  responseItem: { fontSize: 11, color: '#666', marginBottom: 2 },
  patientText: { fontSize: 12, color: '#999', marginTop: 4, fontStyle: 'italic' },
  buttonGroup: { flexDirection: 'row', gap: 10, marginTop: 8 },
  fulfillButton: { flex: 1, backgroundColor: '#4caf50', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  cancelButton: { flex: 1, backgroundColor: '#d32f2f', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', padding: 50 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 10 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5 },
  refreshButton: { marginTop: 20, backgroundColor: '#d32f2f', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 },
  refreshButtonText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalContainer: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#d32f2f' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 15, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  textArea: { height: 80, textAlignVertical: 'top' },
  bloodGroupGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  bloodGroupOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f0f0f0', margin: 4 },
  bloodGroupSelected: { backgroundColor: '#d32f2f' },
  bloodGroupOptionText: { fontSize: 14, color: '#333' },
  bloodGroupSelectedText: { color: '#fff' },
  urgencyContainer: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  urgencyOption: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  urgencyOptionText: { color: '#fff', fontWeight: 'bold' },
  submitButton: { backgroundColor: '#d32f2f', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});