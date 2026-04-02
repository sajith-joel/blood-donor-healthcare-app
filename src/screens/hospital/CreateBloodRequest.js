import React from 'react';
import {
  View,
  StyleSheet
} from 'react-native';
import RequestForm from '../../components/hospital/RequestForm';
import { createBloodRequest } from '../../services/bloodRequestService';
import { getCurrentLocation } from '../../services/locationService';

export default function CreateBloodRequest({ navigation }) {
  const handleSubmit = async (requestData) => {
    try {
      const hospitalLocation = await getCurrentLocation();
      const result = await createBloodRequest({
        ...requestData,
        hospitalLocation
      });
      
      if (result.success) {
        navigation.goBack();
        alert(`Request created! ${result.nearbyDonorsCount} donors notified.`);
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      alert('Error creating request');
    }
  };

  return (
    <View style={styles.container}>
      <RequestForm
        onSubmit={handleSubmit}
        onClose={() => navigation.goBack()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});