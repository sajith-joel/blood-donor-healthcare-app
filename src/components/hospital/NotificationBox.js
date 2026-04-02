import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated
} from 'react-native';

export default function NotificationBox({ notification, onDismiss }) {
  const [fadeAnim] = React.useState(new Animated.Value(1));

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success':
        return '#4caf50';
      case 'error':
        return '#d32f2f';
      case 'warning':
        return '#ff9800';
      default:
        return '#2196f3';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: getNotificationColor(notification.type), opacity: fadeAnim }
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{getNotificationIcon(notification.type)}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{notification.title}</Text>
          <Text style={styles.message}>{notification.message}</Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#fff',
  },
  dismissButton: {
    padding: 4,
  },
  dismissText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
});