import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { db } from './firebaseConfig';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const registerForPushNotifications = async (userId) => {
  try {
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
    console.log('Expo push token:', token);
    
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('blood-donations', {
        name: 'Blood Donations',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    
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

export const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    return { success: true, result };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error };
  }
};

export const sendBulkNotifications = async (donors, requestInfo) => {
  const results = [];
  for (const donor of donors) {
    if (donor.pushToken) {
      const result = await sendPushNotification(
        donor.pushToken,
        `Urgent: ${requestInfo.bloodGroup} Blood Needed`,
        `${requestInfo.hospitalName} needs ${requestInfo.bloodGroup} blood urgently. Distance: ${donor.distance?.toFixed(1)}km away.`,
        {
          requestId: requestInfo.requestId,
          bloodGroup: requestInfo.bloodGroup,
          type: 'blood_request',
          hospitalName: requestInfo.hospitalName
        }
      );
      results.push(result);
    }
  }
  return results;
};

export const sendLocalNotification = async (title, body) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: null,
  });
};

export const scheduleDonationReminder = async (days = 90) => {
  const trigger = new Date();
  trigger.setDate(trigger.getDate() + days);
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to Donate Blood Again!',
      body: 'You can now donate blood again. Your donation can save lives!',
      sound: true,
    },
    trigger,
  });
};