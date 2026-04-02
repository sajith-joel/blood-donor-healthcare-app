const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Send notification to a single donor
 * @param {string} pushToken - Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data
 * @returns {Promise<object>} - Result of notification
 */
async function sendSingleNotification(pushToken, title, body, data = {}) {
  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high'
    };

    const response = await admin.messaging().send(message);
    console.log('Notification sent successfully:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send bulk notifications to multiple donors
 * @param {Array} donors - Array of donor objects with pushToken
 * @param {object} requestInfo - Blood request information
 * @returns {Promise<object>} - Results of notifications
 */
async function sendBulkNotifications(donors, requestInfo) {
  const results = {
    total: donors.length,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const donor of donors) {
    if (!donor.pushToken) {
      results.failed++;
      results.errors.push({ donorId: donor.id, error: 'No push token' });
      continue;
    }

    const title = getNotificationTitle(requestInfo.urgency, requestInfo.bloodGroup);
    const body = getNotificationBody(requestInfo, donor.distance);
    const data = {
      requestId: requestInfo.requestId,
      bloodGroup: requestInfo.bloodGroup,
      hospitalName: requestInfo.hospitalName,
      urgency: requestInfo.urgency,
      type: 'blood_request',
      timestamp: new Date().toISOString()
    };

    const result = await sendSingleNotification(donor.pushToken, title, body, data);
    
    if (result.success) {
      results.successful++;
      // Log notification to database
      await logNotification(donor.id, requestInfo.requestId, 'sent');
    } else {
      results.failed++;
      results.errors.push({ donorId: donor.id, error: result.error });
      await logNotification(donor.id, requestInfo.requestId, 'failed', result.error);
    }
  }

  return results;
}

/**
 * Get notification title based on urgency
 */
function getNotificationTitle(urgency, bloodGroup) {
  switch (urgency) {
    case 'emergency':
      return `🚨 EMERGENCY: ${bloodGroup} Blood Needed Immediately!`;
    case 'high':
      return `⚠️ URGENT: ${bloodGroup} Blood Required`;
    default:
      return `🩸 ${bloodGroup} Blood Donation Request`;
  }
}

/**
 * Get notification body based on request info
 */
function getNotificationBody(requestInfo, distance) {
  let body = `${requestInfo.hospitalName} needs ${requestInfo.bloodGroup} blood`;
  
  if (requestInfo.quantity) {
    body += ` (${requestInfo.quantity} units)`;
  }
  
  if (distance) {
    body += ` - ${distance.toFixed(1)}km away`;
  }
  
  if (requestInfo.urgency === 'emergency') {
    body += ' - IMMEDIATE RESPONSE NEEDED!';
  }
  
  return body;
}

/**
 * Log notification to database for tracking
 */
async function logNotification(donorId, requestId, status, error = null) {
  try {
    await db.collection('notificationLogs').add({
      donorId,
      requestId,
      status,
      error,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: 'blood_request'
    });
  } catch (error) {
    console.error('Error logging notification:', error);
  }
}

/**
 * Send notification to donors within radius
 * @param {object} hospitalLocation - Hospital coordinates
 * @param {string} bloodGroup - Required blood group
 * @param {number} radiusKm - Search radius in kilometers
 * @param {object} requestInfo - Blood request information
 * @returns {Promise<object>} - Results
 */
async function sendNotificationsToNearbyDonors(hospitalLocation, bloodGroup, radiusKm, requestInfo) {
  try {
    // Get donors with matching blood group
    const donorsSnapshot = await db
      .collection('donors')
      .where('bloodGroup', '==', bloodGroup)
      .where('isAvailable', '==', true)
      .get();

    const nearbyDonors = [];
    
    for (const donorDoc of donorsSnapshot.docs) {
      const donor = donorDoc.data();
      
      // Check if donor has location enabled
      if (donor.locationEnabled && donor.currentLocation) {
        const distance = calculateDistance(
          hospitalLocation.latitude,
          hospitalLocation.longitude,
          donor.currentLocation.latitude,
          donor.currentLocation.longitude
        );
        
        if (distance <= radiusKm) {
          // Get donor's push token from users collection
          const userDoc = await db.collection('users').doc(donor.uid).get();
          const pushToken = userDoc.data()?.pushToken;
          
          nearbyDonors.push({
            id: donor.uid,
            pushToken,
            distance,
            ...donor
          });
        }
      }
    }
    
    // Send notifications to nearby donors
    if (nearbyDonors.length > 0) {
      const results = await sendBulkNotifications(nearbyDonors, requestInfo);
      return {
        success: true,
        donorsFound: nearbyDonors.length,
        notificationsSent: results.successful,
        donors: nearbyDonors
      };
    }
    
    return {
      success: true,
      donorsFound: 0,
      notificationsSent: 0,
      message: 'No nearby donors found'
    };
  } catch (error) {
    console.error('Error sending notifications to nearby donors:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Schedule reminder notification for donor
 */
async function scheduleDonationReminder(donorId, daysAfter = 90) {
  try {
    const donorDoc = await db.collection('donors').doc(donorId).get();
    const donor = donorDoc.data();
    
    if (donor.lastDonationDate) {
      const lastDonation = donor.lastDonationDate.toDate();
      const nextEligibleDate = new Date(lastDonation);
      nextEligibleDate.setDate(nextEligibleDate.getDate() + daysAfter);
      
      const today = new Date();
      
      if (today >= nextEligibleDate) {
        // Send reminder notification
        const userDoc = await db.collection('users').doc(donorId).get();
        const pushToken = userDoc.data()?.pushToken;
        
        if (pushToken) {
          await sendSingleNotification(
            pushToken,
            '🩸 You Can Donate Blood Again!',
            `It's been ${daysAfter} days since your last donation. Your blood can save lives!`,
            {
              type: 'donation_reminder',
              donorId: donorId
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error scheduling donation reminder:', error);
  }
}

/**
 * Send hospital confirmation notification
 */
async function sendHospitalConfirmation(donorId, requestId, hospitalName) {
  try {
    const userDoc = await db.collection('users').doc(donorId).get();
    const pushToken = userDoc.data()?.pushToken;
    
    if (pushToken) {
      await sendSingleNotification(
        pushToken,
        '✅ Donation Request Confirmed',
        `${hospitalName} has confirmed your donation. Thank you for saving a life!`,
        {
          type: 'donation_confirmed',
          requestId: requestId,
          hospitalName: hospitalName
        }
      );
    }
  } catch (error) {
    console.error('Error sending hospital confirmation:', error);
  }
}

/**
 * Send request update notification
 */
async function sendRequestUpdateNotification(donorId, requestId, status, message) {
  try {
    const userDoc = await db.collection('users').doc(donorId).get();
    const pushToken = userDoc.data()?.pushToken;
    
    if (pushToken) {
      await sendSingleNotification(
        pushToken,
        `Blood Request ${status.toUpperCase()}`,
        message,
        {
          type: 'request_update',
          requestId: requestId,
          status: status
        }
      );
    }
  } catch (error) {
    console.error('Error sending request update:', error);
  }
}

// Export all functions
module.exports = {
  sendSingleNotification,
  sendBulkNotifications,
  sendNotificationsToNearbyDonors,
  scheduleDonationReminder,
  sendHospitalConfirmation,
  sendRequestUpdateNotification,
  calculateDistance
};