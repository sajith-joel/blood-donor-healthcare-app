const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

// Send bulk notifications to donors
exports.sendBulkNotification = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { donors, requestInfo } = data;
  
  const messages = donors
    .filter(donor => donor.pushToken)
    .map(donor => ({
      to: donor.pushToken,
      sound: 'default',
      title: `🩸 Urgent: ${requestInfo.bloodGroup} Blood Needed`,
      body: `${requestInfo.hospitalName} needs ${requestInfo.bloodGroup} blood urgently. ${donor.distance ? `${donor.distance.toFixed(1)}km away` : ''}`,
      data: {
        requestId: requestInfo.requestId,
        bloodGroup: requestInfo.bloodGroup,
        hospitalName: requestInfo.hospitalName,
        urgency: requestInfo.urgency,
        type: 'blood_request',
        timestamp: new Date().toISOString()
      },
      priority: 'high'
    }));
  
  const promises = messages.map(message => 
    admin.messaging().send(message).catch(error => {
      console.error('Error sending notification to', message.to, error);
      return null;
    })
  );
  
  const results = await Promise.all(promises);
  const successful = results.filter(r => r !== null).length;
  
  return { success: true, sent: successful, total: messages.length };
});

// Save push token for user
exports.savePushToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { userId, token } = data;
  
  if (context.auth.uid !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Cannot save token for different user');
  }
  
  await db.collection('users').doc(userId).update({
    pushToken: token,
    lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { success: true };
});

// Scheduled function to clean up old requests (runs every hour)
exports.cleanupOldRequests = functions.pubsub.schedule('0 * * * *').onRun(async (context) => {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  
  const oldRequests = await db
    .collection('bloodRequests')
    .where('createdAt', '<', admin.firestore.Timestamp.fromDate(twentyFourHoursAgo))
    .where('status', '==', 'active')
    .get();
  
  const batch = db.batch();
  oldRequests.forEach(doc => {
    batch.update(doc.ref, { 
      status: 'expired',
      expiredAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Update hospital active requests count
    const hospitalId = doc.data().hospitalId;
    const hospitalRef = db.collection('hospitals').doc(hospitalId);
    batch.update(hospitalRef, {
      activeRequests: admin.firestore.FieldValue.increment(-1)
    });
  });
  
  await batch.commit();
  console.log(`Cleaned up ${oldRequests.size} old requests`);
  return null;
});

// Calculate donor statistics (runs daily)
exports.calculateDonorStats = functions.pubsub.schedule('0 0 * * *').onRun(async (context) => {
  const donors = await db.collection('donors').get();
  
  for (const donor of donors.docs) {
    const donorData = donor.data();
    const completedDonations = await db
      .collection('bloodRequests')
      .where('fulfilledBy', '==', donor.id)
      .where('status', '==', 'fulfilled')
      .get();
    
    await donor.ref.update({
      totalDonations: completedDonations.size,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  console.log(`Updated stats for ${donors.size} donors`);
  return null;
});

// On user creation trigger
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  console.log('New user created:', user.uid);
  // You can add welcome email logic here
  return null;
});

// On blood request creation trigger
exports.onBloodRequestCreate = functions.firestore
  .document('bloodRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();
    console.log(`New blood request created: ${context.params.requestId} for ${request.bloodGroup}`);
    
    // Log to analytics or trigger additional notifications
    return null;
  });

// HTTP endpoint to get nearby donors (for testing)
exports.getNearbyDonors = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { location, bloodGroup, radiusKm } = data;
  
  const donors = await db
    .collection('donors')
    .where('bloodGroup', '==', bloodGroup)
    .where('isAvailable', '==', true)
    .get();
  
  const nearbyDonors = [];
  for (const donor of donors.docs) {
    const donorData = donor.data();
    if (donorData.currentLocation) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        donorData.currentLocation.latitude,
        donorData.currentLocation.longitude
      );
      
      if (distance <= radiusKm) {
        const userData = await db.collection('users').doc(donor.id).get();
        nearbyDonors.push({
          id: donor.id,
          ...donorData,
          ...userData.data(),
          distance
        });
      }
    }
  }
  
  return { donors: nearbyDonors.sort((a, b) => a.distance - b.distance) };
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}