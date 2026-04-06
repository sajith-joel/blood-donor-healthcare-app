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
  ActivityIndicator,
  Linking,
  Share
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
  deleteDoc
} from 'firebase/firestore';
import { getCurrentLocation } from '../../services/locationService';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function HospitalDashboard({ navigation }) {
  const { user, logout } = useAuth();
  const [requests, setRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hospitalLocation, setHospitalLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBloodGroup, setFilterBloodGroup] = useState(null);
  const [formData, setFormData] = useState({
    bloodGroup: '',
    quantity: '1',
    department: 'Emergency',
    urgency: 'normal',
    patientName: '',
    patientAge: '',
    patientGender: '',
    notes: '',
    searchRadius: 3 // Default 3km
  });

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const departments = ['Emergency', 'ICU', 'Surgery', 'Oncology', 'Pediatrics', 'General Ward', 'Maternity', 'Operation Theatre'];
  const urgencyLevels = [
    { value: 'normal', label: 'Normal', color: '#4caf50', icon: 'info' },
    { value: 'high', label: 'High', color: '#ff9800', icon: 'warning' },
    { value: 'emergency', label: 'Emergency', color: '#d32f2f', icon: 'error' }
  ];
  const radiusOptions = [
    { value: 3, label: '3 km', description: 'Standard range', icon: 'near-me' },
    { value: 5, label: '5 km', description: 'Extended range for rare blood', icon: 'explore' },
    { value: 10, label: '10 km', description: 'Wide range for critical cases', icon: 'public' },
    { value: 15, label: '15 km', description: 'Maximum range', icon: 'flight' }
  ];

  useEffect(() => {
    let unsubscribe;

    if (user?.uid) {
      loadHospitalLocation();
      unsubscribe = subscribeToRequests();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
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

    return onSnapshot(q,
      (snapshot) => {
        const requestsList = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          requestsList.push({ id: doc.id, ...data });
        });
        setRequests(requestsList);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('Error in snapshot:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );
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

    // Auto-set radius for rare blood groups
    const isRare = ['AB-', 'B-', 'A-', 'O-'].includes(formData.bloodGroup);
    let finalRadius = formData.searchRadius;

    // Suggest extended radius for rare blood groups
    if (isRare && formData.searchRadius === 3) {
      Alert.alert(
        'Rare Blood Group Detected',
        `${formData.bloodGroup} is a rare blood group. Would you like to increase the search radius to 5km or more to reach more donors?`,
        [
          { text: 'Keep 3km', onPress: () => createRequest(finalRadius) },
          { text: 'Increase to 5km', onPress: () => createRequest(5) },
          { text: 'Increase to 10km', onPress: () => createRequest(10) }
        ]
      );
      return;
    }

    createRequest(finalRadius);
  };

  const createRequest = async (radius) => {
    const isRare = ['AB-', 'B-', 'A-', 'O-'].includes(formData.bloodGroup);

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
        patientGender: formData.patientGender,
        notes: formData.notes,
        status: 'active',
        radius: radius,
        isRare: isRare,
        createdAt: Timestamp.now(),
        hospitalLocation: {
          latitude: hospitalLocation.latitude,
          longitude: hospitalLocation.longitude
        },
        donorResponses: [],
        totalResponses: 0,
        updatedAt: Timestamp.now()
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
        patientGender: '',
        notes: '',
        searchRadius: 3
      });
    } catch (error) {
      console.error('Error creating request:', error);
      Alert.alert('Error', 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  const updateSearchRadius = async (requestId, newRadius) => {
    Alert.alert(
      'Update Search Radius',
      `Are you sure you want to change the search radius to ${newRadius}km? This will help reach more donors.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              const requestRef = doc(db, 'bloodRequests', requestId);
              await updateDoc(requestRef, {
                radius: newRadius,
                updatedAt: Timestamp.now()
              });
              Alert.alert('Success', `Search radius updated to ${newRadius}km`);
            } catch (error) {
              Alert.alert('Error', 'Failed to update radius');
            }
          }
        }
      ]
    );
  };

  const updateRequestStatus = async (requestId, newStatus) => {
    try {
      console.log("Updating request:", requestId, newStatus);

      const requestRef = doc(db, 'bloodRequests', requestId);

      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });

      Alert.alert("Success", `Request marked as ${newStatus}`);
    } catch (error) {
      console.error("Status update error:", error);
      Alert.alert("Error", error.message);
    }
  };


  const deleteRequest = async (requestId) => {
    try {
      console.log("Deleting request:", requestId);

      await deleteDoc(doc(db, 'bloodRequests', requestId));

      Alert.alert("Deleted", "Request deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      Alert.alert("Error", error.message);
    }
  };

  const callDonor = (phoneNumber) => {
    if (phoneNumber && phoneNumber !== 'Not provided') {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert('No Phone Number', 'This donor has not provided a phone number.');
    }
  };

  const emailDonor = (email) => {
    if (email && email !== 'Not provided') {
      Linking.openURL(`mailto:${email}`);
    } else {
      Alert.alert('No Email', 'This donor has not provided an email address.');
    }
  };

  const openHospitalLocationOnMap = () => {
    if (hospitalLocation) {
      const url = `https://www.google.com/maps/search/?api=1&query=${hospitalLocation.latitude},${hospitalLocation.longitude}`;
      Linking.openURL(url);
    } else {
      Alert.alert('Location Not Available', 'Hospital location not available.');
    }
  };

  const shareRequest = async (request) => {
    try {
      const message = `URGENT: Blood needed at ${request.hospitalName}\n\n` +
        `Blood Group: ${request.bloodGroup}\n` +
        `Quantity: ${request.quantity} units\n` +
        `Department: ${request.department}\n` +
        `Urgency: ${request.urgency.toUpperCase()}\n` +
        `Search Radius: ${request.radius}km\n` +
        `Patient: ${request.patientName || 'Not specified'}\n\n` +
        `Please visit the hospital if you can donate within ${request.radius}km radius. Share this message to help find donors!`;

      await Share.share({
        message: message,
        title: 'Blood Request - Please Help'
      });
    } catch (error) {
      console.error('Error sharing:', error);
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

  const formatResponseTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = Math.floor((now - date) / 60000);

    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} minutes ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  const getFilteredRequests = () => {
    let filtered = [...requests];

    if (selectedTab === 'active') {
      filtered = filtered.filter(r => r.status === 'active');
    } else if (selectedTab === 'fulfilled') {
      filtered = filtered.filter(r => r.status === 'fulfilled');
    }

    if (searchQuery) {
      filtered = filtered.filter(r =>
        r.bloodGroup?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.patientName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterBloodGroup) {
      filtered = filtered.filter(r => r.bloodGroup === filterBloodGroup);
    }

    return filtered;
  };

  const getStatistics = () => {
    const active = requests.filter(r => r.status === 'active').length;
    const fulfilled = requests.filter(r => r.status === 'fulfilled').length;
    const totalResponses = requests.reduce((sum, r) => sum + (r.donorResponses?.length || 0), 0);
    const emergencyRequests = requests.filter(r => r.urgency === 'emergency' && r.status === 'active').length;
    const rareRequests = requests.filter(r => r.isRare && r.status === 'active').length;

    return { active, fulfilled, totalResponses, emergencyRequests, rareRequests };
  };

  const stats = getStatistics();
  const filteredRequests = getFilteredRequests();

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
          <Text style={styles.subtitle}>Welcome, {user?.displayName || user?.email || 'Hospital'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Icon name="logout" size={24} color="#d32f2f" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScrollView}>
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statCard} onPress={() => setShowRequestForm(true)}>
            <Icon name="add-circle" size={32} color="#d32f2f" />
            <Text style={styles.statLabel}>New Request</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard} onPress={() => setSelectedTab('active')}>
            <Text style={styles.statNumber}>{stats.active}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard} onPress={() => setSelectedTab('fulfilled')}>
            <Text style={styles.statNumber}>{stats.fulfilled}</Text>
            <Text style={styles.statLabel}>Fulfilled</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalResponses}</Text>
            <Text style={styles.statLabel}>Responses</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.statCard, { backgroundColor: '#ff9800' }]}>
            <Text style={[styles.statNumber, { color: '#fff' }]}>{stats.emergencyRequests}</Text>
            <Text style={[styles.statLabel, { color: '#fff' }]}>Emergency</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.statCard, { backgroundColor: '#d32f2f' }]}>
            <Text style={[styles.statNumber, { color: '#fff' }]}>{stats.rareRequests}</Text>
            <Text style={[styles.statLabel, { color: '#fff' }]}>Rare Blood</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Location Button */}
      <TouchableOpacity style={styles.locationButton} onPress={openHospitalLocationOnMap}>
        <Icon name="my-location" size={20} color="#fff" />
        <Text style={styles.locationButtonText}>View Hospital Location on Map</Text>
      </TouchableOpacity>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'active' && styles.activeTab]}
          onPress={() => setSelectedTab('active')}
        >
          <Text style={[styles.tabText, selectedTab === 'active' && styles.activeTabText]}>Active Requests</Text>
          {stats.active > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{stats.active}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'fulfilled' && styles.activeTab]}
          onPress={() => setSelectedTab('fulfilled')}
        >
          <Text style={[styles.tabText, selectedTab === 'fulfilled' && styles.activeTabText]}>Fulfilled</Text>
        </TouchableOpacity>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Icon name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by blood group, department..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, !filterBloodGroup && styles.activeFilterChip]}
            onPress={() => setFilterBloodGroup(null)}
          >
            <Text style={[styles.filterChipText, !filterBloodGroup && styles.activeFilterChipText]}>All</Text>
          </TouchableOpacity>
          {bloodGroups.map(group => (
            <TouchableOpacity
              key={group}
              style={[styles.filterChip, filterBloodGroup === group && styles.activeFilterChip]}
              onPress={() => setFilterBloodGroup(filterBloodGroup === group ? null : group)}
            >
              <Text style={[styles.filterChipText, filterBloodGroup === group && styles.activeFilterChipText]}>{group}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Requests List */}
      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.requestCard}>
            {/* Request Header */}
            <View style={styles.requestHeader}>
              <View style={styles.bloodGroupCircle}>
                <Text style={styles.bloodGroupText}>{item.bloodGroup}</Text>
                {item.isRare && <Text style={styles.rareStar}>⭐</Text>}
              </View>
              <View style={styles.requestHeaderInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.departmentText}>{item.department || 'Blood Bank'}</Text>
                  <View style={[styles.urgencyBadge, { backgroundColor: urgencyLevels.find(u => u.value === item.urgency)?.color || '#4caf50' }]}>
                    <Icon name={urgencyLevels.find(u => u.value === item.urgency)?.icon || 'info'} size={12} color="#fff" />
                    <Text style={styles.urgencyText}>{item.urgency.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.quantityText}>Need {item.quantity} unit(s)</Text>
                <Text style={styles.dateText}>{item.createdAt?.toDate().toLocaleString() || 'Just now'}</Text>
              </View>
              <TouchableOpacity onPress={() => shareRequest(item)} style={styles.shareButton}>
                <Icon name="share" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Search Radius Section */}
            <View style={styles.radiusSection}>
              <View style={styles.radiusInfo}>
                <Icon name="near-me" size={16} color="#2196f3" />
                <Text style={styles.radiusLabel}>Search Radius:</Text>
                <Text style={styles.radiusValue}>{item.radius} km</Text>
                {item.isRare && (
                  <View style={styles.rareRadiusBadge}>
                    <Text style={styles.rareRadiusText}>Extended for rare blood</Text>
                  </View>
                )}
              </View>
              {item.status === 'active' && (
                <TouchableOpacity
                  style={styles.editRadiusButton}
                  onPress={() => updateSearchRadius(item.id, item.radius === 3 ? 5 : item.radius === 5 ? 10 : 15)}
                >
                  <Icon name="edit" size={16} color="#fff" />
                  <Text style={styles.editRadiusText}>Expand Radius</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Patient Info */}
            {(item.patientName || item.patientAge || item.patientGender) && (
              <View style={styles.patientInfo}>
                <Icon name="person" size={16} color="#d32f2f" />
                <Text style={styles.patientInfoText}>
                  {item.patientName && `👤 ${item.patientName}`}
                  {item.patientAge && ` | Age: ${item.patientAge}`}
                  {item.patientGender && ` | ${item.patientGender}`}
                </Text>
              </View>
            )}

            {/* Notes */}
            {item.notes && (
              <View style={styles.notesContainer}>
                <Icon name="note" size={14} color="#666" />
                <Text style={styles.notesText}>{item.notes}</Text>
              </View>
            )}

            {/* Donor Responses Section */}
            <View style={styles.donorSection}>
              <View style={styles.donorSectionHeader}>
                <Icon name="people" size={20} color="#d32f2f" />
                <Text style={styles.donorSectionTitle}>
                  Donor Responses ({item.donorResponses?.length || 0})
                </Text>
                {(item.donorResponses?.length || 0) > 0 && (
                  <Text style={styles.responseTimeText}>
                    Newest: {formatResponseTime(item.donorResponses[item.donorResponses.length - 1]?.respondedAt)}
                  </Text>
                )}
              </View>

              {item.donorResponses && item.donorResponses.length > 0 ? (
                <View>
                  {item.donorResponses.map((donor, idx) => (
                    <View key={idx} style={styles.donorCard}>
                      <View style={styles.donorHeader}>
                        <View>
                          <Text style={styles.donorName}>🩸 {donor.donorName || donor.name || 'Anonymous Donor'}</Text>
                          <Text style={styles.donorBlood}>Blood Group: {donor.bloodGroup || 'Unknown'}</Text>
                        </View>
                        <View style={styles.donorTimeContainer}>
                          <Text style={styles.donorTime}>
                            {formatResponseTime(donor.respondedAt)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.donorContactInfo}>
                        <View style={styles.contactRow}>
                          <Icon name="call" size={16} color="#4caf50" />
                          <Text style={styles.contactText}>📞 {donor.phone || 'No phone number'}</Text>
                          {donor.phone && donor.phone !== 'Not provided' && (
                            <TouchableOpacity
                              style={styles.callButton}
                              onPress={() => callDonor(donor.phone)}
                            >
                              <Text style={styles.callButtonText}>Call Now</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <View style={styles.contactRow}>
                          <Icon name="email" size={16} color="#2196f3" />
                          <Text style={styles.contactText}>📧 {donor.email || 'No email'}</Text>
                          {donor.email && donor.email !== 'Not provided' && (
                            <TouchableOpacity
                              style={styles.emailButton}
                              onPress={() => emailDonor(donor.email)}
                            >
                              <Text style={styles.emailButtonText}>Send Email</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      <View style={styles.responseStatus}>
                        <Text style={styles.statusText}>✅ Status: Ready to donate</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noDonorsContainer}>
                  <Icon name="people-outline" size={40} color="#ccc" />
                  <Text style={styles.noDonorsText}>No donors have responded yet</Text>
                  <Text style={styles.noDonorsSubtext}>Share this request to get responses</Text>
                  <TouchableOpacity style={styles.shareRequestButton} onPress={() => shareRequest(item)}>
                    <Text style={styles.shareRequestButtonText}>📢 Share Request</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {item.status === 'active' && (
                <>
                  <TouchableOpacity
                    style={styles.fulfillButton}
                    onPress={() => {
                      console.log("Mark Fulfilled clicked", item.id);
                      updateRequestStatus(item.id, 'fulfilled');
                    }}
                  >
                    <Icon name="check-circle" size={18} color="#fff" />
                    <Text style={styles.buttonText}>Mark Fulfilled</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      console.log("Cancel clicked", item.id);
                      updateRequestStatus(item.id, 'cancelled');
                    }}
                  >
                    <Icon name="cancel" size={18} color="#fff" />
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  console.log("Delete clicked", item.id);
                  deleteRequest(item.id);
                }}
              >
                <Icon name="delete" size={18} color="#fff" />
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="inbox" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {selectedTab === 'active' ? 'No active requests' : 'No fulfilled requests'}
            </Text>
            <Text style={styles.emptySubtext}>Tap "New Request" to create one</Text>
            {selectedTab === 'active' && (
              <TouchableOpacity style={styles.createButtonLarge} onPress={() => setShowRequestForm(true)}>
                <Text style={styles.createButtonText}>+ Create New Request</Text>
              </TouchableOpacity>
            )}
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
                    onPress={() => setFormData({ ...formData, bloodGroup: group })}
                  >
                    <Text style={[styles.bloodGroupOptionText, formData.bloodGroup === group && styles.bloodGroupSelectedText]}>
                      {group}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Quantity (units) *</Text>
              <View style={styles.quantityContainer}>
                {[1, 2, 3, 4, 5].map(num => (
                  <TouchableOpacity
                    key={num}
                    style={[styles.quantityOption, formData.quantity === num.toString() && styles.quantitySelected]}
                    onPress={() => setFormData({ ...formData, quantity: num.toString() })}
                  >
                    <Text style={[styles.quantityOptionText, formData.quantity === num.toString() && styles.quantitySelectedText]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={styles.quantityInput}
                  value={formData.quantity}
                  onChangeText={(text) => setFormData({ ...formData, quantity: text })}
                  keyboardType="numeric"
                  placeholder="Custom"
                  placeholderTextColor="#999"
                />
              </View>

              <Text style={styles.inputLabel}>Department</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.departmentScroll}>
                {departments.map(dept => (
                  <TouchableOpacity
                    key={dept}
                    style={[styles.departmentOption, formData.department === dept && styles.departmentSelected]}
                    onPress={() => setFormData({ ...formData, department: dept })}
                  >
                    <Text style={[styles.departmentOptionText, formData.department === dept && styles.departmentSelectedText]}>
                      {dept}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Search Radius *</Text>
              <Text style={styles.radiusHelperText}>Select how far to search for donors</Text>
              <View style={styles.radiusGrid}>
                {radiusOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.radiusOption,
                      formData.searchRadius === option.value && styles.radiusOptionSelected,
                      formData.searchRadius === option.value && { borderColor: '#d32f2f', borderWidth: 2 }
                    ]}
                    onPress={() => setFormData({ ...formData, searchRadius: option.value })}
                  >
                    <Icon name={option.icon} size={24} color={formData.searchRadius === option.value ? '#d32f2f' : '#666'} />
                    <Text style={[styles.radiusOptionValue, formData.searchRadius === option.value && styles.radiusOptionValueSelected]}>
                      {option.label}
                    </Text>
                    <Text style={styles.radiusOptionDesc}>{option.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Urgency Level *</Text>
              <View style={styles.urgencyContainer}>
                {urgencyLevels.map(level => (
                  <TouchableOpacity
                    key={level.value}
                    style={[styles.urgencyOption, { backgroundColor: level.color }, formData.urgency === level.value && styles.urgencySelected]}
                    onPress={() => setFormData({ ...formData, urgency: level.value })}
                  >
                    <Icon name={level.icon} size={20} color="#fff" />
                    <Text style={styles.urgencyOptionText}>{level.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Patient Information (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.patientName}
                onChangeText={(text) => setFormData({ ...formData, patientName: text })}
                placeholder="Patient Name"
                placeholderTextColor="#999"
              />

              <View style={styles.rowInput}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  value={formData.patientAge}
                  onChangeText={(text) => setFormData({ ...formData, patientAge: text })}
                  placeholder="Age"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  value={formData.patientGender}
                  onChangeText={(text) => setFormData({ ...formData, patientGender: text })}
                  placeholder="Gender"
                  placeholderTextColor="#999"
                />
              </View>

              <Text style={styles.inputLabel}>Additional Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="Any special requirements or instructions..."
                placeholderTextColor="#999"
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

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', elevation: 2 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#d32f2f' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  logoutButton: { padding: 8 },

  // Stats
  statsScrollView: { flexGrow: 0 },
  statsContainer: { flexDirection: 'row', padding: 15, gap: 12 },
  statCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, alignItems: 'center', minWidth: 90, elevation: 2 },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: '#d32f2f' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },

  // Location Button
  locationButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2196f3', marginHorizontal: 15, marginTop: 5, padding: 12, borderRadius: 10, gap: 8 },
  locationButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // Tabs
  tabContainer: { flexDirection: 'row', marginHorizontal: 15, marginTop: 15, backgroundColor: '#fff', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  activeTab: { backgroundColor: '#d32f2f' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#666' },
  activeTabText: { color: '#fff' },
  tabBadge: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  tabBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#d32f2f' },

  // Search
  searchContainer: { paddingHorizontal: 15, paddingVertical: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 14 },
  filterScroll: { flexGrow: 0, marginTop: 10 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 8 },
  activeFilterChip: { backgroundColor: '#d32f2f' },
  filterChipText: { fontSize: 12, color: '#666' },
  activeFilterChipText: { color: '#fff' },

  // Request Card
  requestCard: { backgroundColor: '#fff', margin: 15, marginTop: 8, padding: 15, borderRadius: 12, elevation: 2 },
  requestHeader: { flexDirection: 'row', marginBottom: 12 },
  bloodGroupCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#d32f2f', justifyContent: 'center', alignItems: 'center', marginRight: 12, position: 'relative' },
  bloodGroupText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  rareStar: { position: 'absolute', top: -5, right: -5, fontSize: 12 },
  requestHeaderInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 4 },
  departmentText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  urgencyBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  urgencyText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  quantityText: { fontSize: 14, color: '#666', marginTop: 2 },
  dateText: { fontSize: 10, color: '#999', marginTop: 4 },
  shareButton: { padding: 8 },

  // Radius Section
  radiusSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f7ff', padding: 10, borderRadius: 8, marginBottom: 10 },
  radiusInfo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  radiusLabel: { fontSize: 12, color: '#666' },
  radiusValue: { fontSize: 14, fontWeight: 'bold', color: '#2196f3' },
  rareRadiusBadge: { backgroundColor: '#ff9800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  rareRadiusText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  editRadiusButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2196f3', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, gap: 4 },
  editRadiusText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Patient Info
  patientInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 8 },
  patientInfoText: { fontSize: 13, color: '#666', flex: 1 },

  // Notes
  notesContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 10, borderRadius: 8, marginBottom: 12, gap: 8 },
  notesText: { fontSize: 12, color: '#666', flex: 1 },

  // Donor Section
  donorSection: { marginTop: 5, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  donorSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap' },
  donorSectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginLeft: 8, flex: 1 },
  responseTimeText: { fontSize: 10, color: '#999' },
  donorCard: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#d32f2f' },
  donorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' },
  donorName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  donorBlood: { fontSize: 13, color: '#d32f2f', fontWeight: '500' },
  donorTimeContainer: { backgroundColor: '#e0e0e0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  donorTime: { fontSize: 10, color: '#666' },
  donorContactInfo: { marginBottom: 10 },
  contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  contactText: { fontSize: 13, color: '#666', marginLeft: 8, flex: 1 },
  callButton: { backgroundColor: '#4caf50', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15, marginLeft: 8 },
  callButtonText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  emailButton: { backgroundColor: '#2196f3', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15, marginLeft: 8 },
  emailButtonText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  responseStatus: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  statusText: { fontSize: 11, color: '#4caf50', fontWeight: '500' },

  noDonorsContainer: { alignItems: 'center', padding: 30 },
  noDonorsText: { fontSize: 14, color: '#999', marginTop: 10 },
  noDonorsSubtext: { fontSize: 12, color: '#ccc', marginTop: 5, textAlign: 'center' },
  shareRequestButton: { marginTop: 15, backgroundColor: '#d32f2f', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  shareRequestButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  // Action Buttons
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#e0e0e0', gap: 10 },
  fulfillButton: { flex: 1, backgroundColor: '#4caf50', paddingVertical: 10, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  cancelButton: { flex: 1, backgroundColor: '#ff9800', paddingVertical: 10, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  deleteButton: { flex: 1, backgroundColor: '#d32f2f', paddingVertical: 10, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  // Empty State
  emptyContainer: { alignItems: 'center', padding: 50 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 10 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 5 },
  createButtonLarge: { marginTop: 20, backgroundColor: '#d32f2f', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
  createButtonText: { color: '#fff', fontWeight: 'bold' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalContainer: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#d32f2f' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 15, marginBottom: 8 },
  radiusHelperText: { fontSize: 12, color: '#666', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' },
  textArea: { height: 80, textAlignVertical: 'top' },
  rowInput: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },

  // Blood Group Grid
  bloodGroupGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  bloodGroupOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f0f0f0', margin: 4 },
  bloodGroupSelected: { backgroundColor: '#d32f2f' },
  bloodGroupOptionText: { fontSize: 14, color: '#333' },
  bloodGroupSelectedText: { color: '#fff' },

  // Quantity
  quantityContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  quantityOption: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  quantitySelected: { backgroundColor: '#d32f2f' },
  quantityOptionText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  quantitySelectedText: { color: '#fff' },
  quantityInput: { width: 80, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, textAlign: 'center' },

  // Department
  departmentScroll: { flexGrow: 0, marginBottom: 10 },
  departmentOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 8 },
  departmentSelected: { backgroundColor: '#d32f2f' },
  departmentOptionText: { fontSize: 14, color: '#333' },
  departmentSelectedText: { color: '#fff' },

  // Radius Grid
  radiusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  radiusOption: { flex: 1, minWidth: '45%', backgroundColor: '#f5f5f5', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  radiusOptionSelected: { backgroundColor: '#fff0f0' },
  radiusOptionValue: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 8 },
  radiusOptionValueSelected: { color: '#d32f2f' },
  radiusOptionDesc: { fontSize: 10, color: '#999', marginTop: 4 },

  // Urgency
  urgencyContainer: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  urgencyOption: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  urgencySelected: { borderWidth: 2, borderColor: '#333' },
  urgencyOptionText: { color: '#fff', fontWeight: 'bold' },

  // Submit Button
  submitButton: { backgroundColor: '#d32f2f', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});