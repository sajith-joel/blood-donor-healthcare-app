import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { db } from './firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: Platform.OS !== 'web',
    shouldSetBadge: Platform.OS !== 'web',
  }),
});

export const registerForPushNotifications = async (userId) => {
  try {
    // For web, we need VAPID key configured in app.json
    // If not configured, skip registration
    if (Platform.OS === 'web') {
      console.log('Web push notifications require VAPID key in app.json');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Push token:', token);
    
    // Save token to Firestore
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      pushToken: token,
      tokenUpdatedAt: new Date().toISOString()
    });
    
    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
};

export const sendLocalNotification = async (title, body) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: Platform.OS !== 'web',
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error sending local notification:', error);
  }
};