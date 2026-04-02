import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert
} from 'react-native';
import Button from '../../components/common/Button';
import Loader from '../../components/common/Loader';

export default function OTPVerificationScreen({ route, navigation }) {
  const { phoneNumber, verificationId } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter complete OTP');
      return;
    }

    setLoading(true);
    // Verify OTP logic here
    // const credential = PhoneAuthProvider.credential(verificationId, otpCode);
    // await signInWithCredential(auth, credential);
    setLoading(false);
    navigation.navigate('Login');
  };

  const handleResendOTP = () => {
    if (timeLeft > 0) return;
    setTimeLeft(60);
    // Resend OTP logic here
    Alert.alert('Success', 'OTP resent successfully');
  };

  return (
    <View style={styles.container}>
      <Loader visible={loading} />
      <View style={styles.content}>
        <Text style={styles.title}>Verify Phone Number</Text>
        <Text style={styles.subtitle}>
          We've sent a 6-digit verification code to {phoneNumber}
        </Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => inputRefs.current[index] = ref}
              style={styles.otpInput}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
            />
          ))}
        </View>

        <Button title="Verify" onPress={handleVerify} style={styles.verifyButton} />

        <TouchableOpacity onPress={handleResendOTP} disabled={timeLeft > 0}>
          <Text style={styles.resendText}>
            {timeLeft > 0 ? `Resend code in ${timeLeft}s` : 'Resend Code'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  otpInput: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    fontSize: 20,
    fontWeight: 'bold',
    backgroundColor: '#f9f9f9',
  },
  verifyButton: {
    marginBottom: 20,
  },
  resendText: {
    textAlign: 'center',
    color: '#d32f2f',
    fontSize: 14,
  },
});