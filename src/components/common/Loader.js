import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Text
} from 'react-native';

export default function Loader({ visible = false, text = 'Loading...' }) {
  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#d32f2f" />
          {text && <Text style={styles.text}>{text}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 150,
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    color: '#333',
  },
});