import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import InputField from '../../components/common/InputField';
import Button from '../../components/common/Button';
import Loader from '../../components/common/Loader';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    bloodGroup: '',
    userType: 'donor',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { register } = useAuth();

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.password || !formData.phone) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (formData.userType === 'donor' && !formData.bloodGroup) {
      Alert.alert('Error', 'Please select your blood group');
      return;
    }

    setLoading(true);
    const result = await register(formData.email, formData.password, {
      name: formData.name,
      phone: formData.phone,
      bloodGroup: formData.bloodGroup,
      userType: formData.userType,
      address: formData.address,
      createdAt: new Date().toISOString()
    }, rememberMe);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Registration Failed', result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Loader visible={loading} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Register as Donor or Hospital</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.userTypeContainer}>
            <TouchableOpacity
              style={[
                styles.userTypeButton,
                formData.userType === 'donor' && styles.selectedUserType
              ]}
              onPress={() => setFormData({ ...formData, userType: 'donor' })}
            >
              <Text style={[
                styles.userTypeText,
                formData.userType === 'donor' && styles.selectedUserTypeText
              ]}>🩸 Donor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.userTypeButton,
                formData.userType === 'hospital' && styles.selectedUserType
              ]}
              onPress={() => setFormData({ ...formData, userType: 'hospital' })}
            >
              <Text style={[
                styles.userTypeText,
                formData.userType === 'hospital' && styles.selectedUserTypeText
              ]}>🏥 Hospital</Text>
            </TouchableOpacity>
          </View>

          <InputField
            label="Full Name"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter your full name"
            required
          />

          <InputField
            label="Email"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            placeholder="Enter your email"
            keyboardType="email-address"
            required
          />

          <InputField
            label="Phone Number"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
            required
          />

          {formData.userType === 'donor' && (
            <>
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
            </>
          )}

          {formData.userType === 'hospital' && (
            <InputField
              label="Hospital Address"
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
              placeholder="Enter hospital address"
              multiline
            />
          )}

          <InputField
            label="Password"
            value={formData.password}
            onChangeText={(text) => setFormData({ ...formData, password: text })}
            placeholder="Create a password"
            secureTextEntry
            required
          />

          <InputField
            label="Confirm Password"
            value={formData.confirmPassword}
            onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
            placeholder="Confirm your password"
            secureTextEntry
            required
          />

          {/* Remember Me Switch */}
          <View style={styles.rememberContainer}>
            <View style={styles.rememberRow}>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                trackColor={{ false: '#767577', true: '#d32f2f' }}
                thumbColor={rememberMe ? '#fff' : '#f4f3f4'}
              />
              <Text style={styles.rememberText}>Stay logged in</Text>
            </View>
          </View>

          <Button title="Register" onPress={handleRegister} style={styles.registerButton} />

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginLinkText}>Login</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              {rememberMe ? '✓ You will stay logged in even after closing the app' : 'ℹ️ You will be logged out when you close the app'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  userTypeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    padding: 4,
  },
  userTypeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  selectedUserType: {
    backgroundColor: '#d32f2f',
  },
  userTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  selectedUserTypeText: {
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
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
  rememberContainer: {
    marginTop: 15,
    marginBottom: 10,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  registerButton: {
    marginTop: 10,
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLinkText: {
    color: '#d32f2f',
    fontWeight: 'bold',
  },
  infoContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  infoText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});