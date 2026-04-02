import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import InputField from '../common/InputField';
import Button from '../common/Button';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const URGENCY_LEVELS = ['normal', 'high', 'emergency'];

export default function RequestForm({ onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    bloodGroup: '',
    quantity: '',
    department: '',
    patientName: '',
    urgency: 'normal',
    additionalNotes: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.bloodGroup) {
      Alert.alert('Error', 'Please select blood group');
      return;
    }
    if (!formData.quantity) {
      Alert.alert('Error', 'Please enter quantity');
      return;
    }

    setLoading(true);
    await onSubmit(formData);
    setLoading(false);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Blood Request</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Blood Group</Text>
            <View style={styles.bloodGroupContainer}>
              {BLOOD_GROUPS.map((group) => (
                <TouchableOpacity
                  key={group}
                  style={[
                    styles.bloodGroupButton,
                    formData.bloodGroup === group && styles.selectedBloodGroup
                  ]}
                  onPress={() => setFormData({ ...formData, bloodGroup: group })}
                >
                  <Text style={[
                    styles.bloodGroupText,
                    formData.bloodGroup === group && styles.selectedBloodGroupText
                  ]}>
                    {group}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <InputField
              label="Quantity (units)"
              value={formData.quantity}
              onChangeText={(text) => setFormData({ ...formData, quantity: text })}
              placeholder="Enter number of units needed"
              keyboardType="numeric"
              required
            />

            <InputField
              label="Department"
              value={formData.department}
              onChangeText={(text) => setFormData({ ...formData, department: text })}
              placeholder="e.g., Emergency, ICU, Surgery"
            />

            <InputField
              label="Patient Name (Optional)"
              value={formData.patientName}
              onChangeText={(text) => setFormData({ ...formData, patientName: text })}
              placeholder="Patient name"
            />

            <Text style={styles.sectionTitle}>Urgency Level</Text>
            <View style={styles.urgencyContainer}>
              {URGENCY_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.urgencyButton,
                    formData.urgency === level && styles.selectedUrgency,
                    level === 'emergency' && styles.emergencyButton,
                    level === 'high' && styles.highUrgencyButton
                  ]}
                  onPress={() => setFormData({ ...formData, urgency: level })}
                >
                  <Text style={[
                    styles.urgencyText,
                    formData.urgency === level && styles.selectedUrgencyText
                  ]}>
                    {level.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <InputField
              label="Additional Notes"
              value={formData.additionalNotes}
              onChangeText={(text) => setFormData({ ...formData, additionalNotes: text })}
              placeholder="Any specific requirements..."
              multiline
              numberOfLines={3}
            />

            <View style={styles.buttonContainer}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={onClose}
                style={styles.cancelButton}
              />
              <Button
                title="Create Request"
                onPress={handleSubmit}
                loading={loading}
                style={styles.submitButton}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '90%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  bloodGroupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  bloodGroupButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    margin: 4,
  },
  selectedBloodGroup: {
    backgroundColor: '#d32f2f',
  },
  bloodGroupText: {
    fontSize: 14,
    color: '#333',
  },
  selectedBloodGroupText: {
    color: '#fff',
  },
  urgencyContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  urgencyButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
    alignItems: 'center',
  },
  selectedUrgency: {
    backgroundColor: '#4caf50',
  },
  emergencyButton: {
    backgroundColor: '#ffebee',
  },
  highUrgencyButton: {
    backgroundColor: '#fff3e0',
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedUrgencyText: {
    color: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 24,
    marginBottom: 16,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
  },
  submitButton: {
    flex: 1,
    marginLeft: 8,
  },
});