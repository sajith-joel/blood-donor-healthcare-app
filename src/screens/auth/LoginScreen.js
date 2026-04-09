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
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    const result = await login(email, password, rememberMe);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Login Failed', result.error);
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
          <Text style={styles.title}>🩸 Blood Donor App</Text>
          <Text style={styles.subtitle}>Login to your account</Text>
        </View>

        <View style={styles.form}>
          <InputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            required
          />

          <InputField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
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
              <Text style={styles.rememberText}>Remember Me</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <Button title="Login" onPress={handleLogin} style={styles.loginButton} />

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerText}>
              Don't have an account? <Text style={styles.registerLinkText}>Register</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.infoContainer}>
            <Icon name="info" size={16} color="#999" />
            <Text style={styles.infoText}>
              {rememberMe ? 'You will stay logged in' : 'You will be logged out when you close the app'}
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
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  rememberContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
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
  forgotText: {
    fontSize: 14,
    color: '#d32f2f',
  },
  loginButton: {
    marginTop: 10,
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#666',
  },
  registerLinkText: {
    color: '#d32f2f',
    fontWeight: 'bold',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 5,
  },
  infoText: {
    fontSize: 12,
    color: '#999',
  },
});