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
        const data = doc.data();
        console.log('Request data:', doc.id, data);
        console.log('Donor responses count:', data.donorResponses?.length || 0);
        if (data.donorResponses && data.donorResponses.length > 0) {
          console.log('Donor details:', JSON.stringify(data.donorResponses));
        }
        requestsList.push({ id: doc.id, ...data });
      });
      setRequests(requestsList);
      setLoading(false);
    }, (error) => {
      console.error('Error:', error);
      setLoading(false);
    });
  };

  const createBloodRequest = async () => {
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
        hospitalEmail: user.email,
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
      Alert.alert('Error', 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (requestId, newStatus) => {
    try {
      const requestRef = doc(db, 'bloodRequests', requestId);
      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      Alert.alert('Success', `Request marked as ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update request');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
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
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🏥 Hospital Dashboard</Text>
          <Text style={styles.subtitle}>Welcome, {user?.displayName || user?.email || 'Hospital'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Icon name="logout" size={24} color="#d32f2f" />
        </TouchableOpacity>
      </View>

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
            <View style={styles.requestHeader}>
              <View style={styles.bloodGroupCircle}>
                <Text style={styles.bloodGroupText}>{item.bloodGroup}</Text>
              </View>
              <View style={styles.requestHeaderInfo}>
                <Text style={styles.departmentText}>{item.department || 'Blood Bank'}</Text>
                <Text style={styles.quantityText}>Need {item.quantity} unit(s)</Text>
                <View style={[styles.urgencyBadge, { backgroundColor: urgencyLevels.find(u => u.value === item.urgency)?.color || '#4caf50' }]}>
                  <Text style={styles.urgencyText}>{item.urgency.toUpperCase()}</Text>
                </View>
                {item.isRare && (
                  <View style={styles.rareBadge}>
                    <Text style={styles.rareText}>⭐ RARE BLOOD</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Donor Responses Section - This is where donor details appear */}
            <View style={styles.donorSection}>
              <Text style={styles.donorSectionTitle}>
                👥 Donor Responses ({item.donorResponses?.length || 0})
              </Text>
              
              {item.donorResponses && item.donorResponses.length > 0 ? (
                <View>
                  {item.donorResponses.map((donor, idx) => (
                    <View key={idx} style={styles.donorCard}>
                      <View style={styles.donorHeader}>
                        <Text style={styles.donorName}>🩸 {donor.donorName || donor.name || 'Anonymous'}</Text>
                        <Text style={styles.donorBlood}>{donor.bloodGroup || 'Unknown'}</Text>
                      </View>
                      <View style={styles.donorDetails}>
                        <Text style={styles.donorDetail}>📞 Phone: {donor.phone || 'Not provided'}</Text>
                        <Text style={styles.donorDetail}>📧 Email: {donor.email || user?.email || 'Not provided'}</Text>
                        <Text style={styles.donorTime}>
                          Responded: {donor.respondedAt?.toDate().toLocaleString() || 'Just now'}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.contactButton}
                        onPress={() => {
                          Alert.alert(
                            'Contact Donor',
                            `Name: ${donor.donorName || donor.name}\nPhone: ${donor.phone}\nEmail: ${donor.email}\n\nYou can contact them using these details.`
                          );
                        }}
                      >
                        <Icon name="call" size={16} color="#fff" />
                        <Text style={styles.contactButtonText}>Contact Donor</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noDonorsContainer}>
                  <Text style={styles.noDonorsText}>No donors have responded yet</Text>
                  <Text style={styles.noDonorsSubtext}>Donors will appear here when they respond</Text>
                </View>
              )}
            </View>

            <View style={styles.requestFooter}>
              <Text style={styles.timeText}>
                Created: {item.createdAt?.toDate().toLocaleString() || 'Just now'}
              </Text>
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 10, color: '#666' },
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
  requestHeader: { flexDirection: 'row', marginBottom: 15 },
  bloodGroupCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#d32f2f', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  bloodGroupText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  requestHeaderInfo: { flex: 1 },
  departmentText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  quantityText: { fontSize: 14, color: '#666', marginTop: 2 },
  urgencyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 6 },
  urgencyText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  rareBadge: { backgroundColor: '#ff9800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 4 },
  rareText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  donorSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  donorSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  donorCard: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#d32f2f' },
  donorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  donorName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  donorBlood: { fontSize: 12, fontWeight: 'bold', color: '#d32f2f' },
  donorDetails: { marginBottom: 8 },
  donorDetail: { fontSize: 12, color: '#666', marginBottom: 2 },
  donorTime: { fontSize: 10, color: '#999', marginTop: 4 },
  contactButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4caf50', paddingVertical: 8, borderRadius: 6, marginTop: 6 },
  contactButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  noDonorsContainer: { alignItems: 'center', padding: 20 },
  noDonorsText: { fontSize: 14, color: '#999' },
  noDonorsSubtext: { fontSize: 12, color: '#ccc', marginTop: 4 },
  requestFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  timeText: { fontSize: 10, color: '#999' },
  buttonGroup: { flexDirection: 'row', gap: 8 },
  fulfillButton: { backgroundColor: '#4caf50', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  cancelButton: { backgroundColor: '#d32f2f', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', padding: 50 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 10 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5 },
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
  urgencyContainer: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  urgencyOption: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  urgencyOptionText: { color: '#fff', fontWeight: 'bold' },
  submitButton: { backgroundColor: '#d32f2f', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});