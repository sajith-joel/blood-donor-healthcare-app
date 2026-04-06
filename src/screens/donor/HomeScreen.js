import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  getDoc,
  arrayUnion
} from 'firebase/firestore';
import { getCurrentLocation } from '../../services/locationService';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Replace ONLY your existing respondToRequest function with the below
const respondToRequest = async (request) => {
  console.log('=== RESPOND BUTTON CLICKED ===');
  console.log('Request ID:', request.id);
  console.log('User Data:', userData);

  if (!userData?.phone) {
    Alert.alert(
      'Phone Number Required',
      'Please update your profile with a phone number so the hospital can contact you.',
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Update Now', onPress: () => navigation.navigate('Profile') }
      ]
    );
    return;
  }

  const donorDetails = {
    donorId: user.uid,
    donorName: userData?.name || 'Anonymous Donor',
    bloodGroup: userData?.bloodGroup || 'Unknown',
    phone: userData?.phone || 'Not provided',
    email: user?.email || 'Not provided',
    respondedAt: Timestamp.now(),
    status: 'pending',
    message: `Donor responded to ${request.bloodGroup} blood request`
  };

  Alert.alert(
    'Confirm Donation',
    `Do you want to share your details with ${request.hospitalName}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Share My Details',
        onPress: async () => {
          try {
            const requestRef = doc(db, 'bloodRequests', request.id);

            await updateDoc(requestRef, {
              donorResponses: arrayUnion(donorDetails),
              lastResponseAt: Timestamp.now()
            });

            Alert.alert(
              '✅ Response Sent!',
              `Your details have been sent to ${request.hospitalName}.`
            );
          } catch (error) {
            console.error('Error responding:', error);
            Alert.alert('Error', 'Failed to send response: ' + error.message);
          }
        }
      }
    ]
  );
};
