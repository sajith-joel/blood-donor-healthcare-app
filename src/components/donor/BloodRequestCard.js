import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function BloodRequestCard({ 
  request, 
  onPress, 
  onRespond, 
  showRespondButton = false,
  footerText = null,
  style = {}
}) {
  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'emergency':
        return '#d32f2f';
      case 'high':
        return '#ff9800';
      default:
        return '#4caf50';
    }
  };

  const getUrgencyIcon = (urgency) => {
    switch (urgency) {
      case 'emergency':
        return '🚨';
      case 'high':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 60000);
    
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} minutes ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

  const formatTimeRemaining = (createdAt) => {
    if (!createdAt) return null;
    const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const expiry = new Date(created);
    expiry.setHours(expiry.getHours() + 24);
    const now = new Date();
    const hoursRemaining = Math.floor((expiry - now) / (1000 * 60 * 60));
    
    if (hoursRemaining <= 0) return 'Expiring soon';
    if (hoursRemaining < 24) return `${hoursRemaining} hours left`;
    return null;
  };

  const timeRemaining = formatTimeRemaining(request.createdAt);

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(request.urgency) }]}>
          <Text style={styles.urgencyText}>
            {getUrgencyIcon(request.urgency)} {request.urgency.toUpperCase()}
          </Text>
        </View>
        {request.isRare && (
          <View style={styles.rareBadge}>
            <Text style={styles.rareText}>⭐ RARE BLOOD</Text>
          </View>
        )}
      </View>

      <View style={styles.bloodGroupSection}>
        <View style={styles.bloodGroupCircle}>
          <Text style={styles.bloodGroupText}>{request.bloodGroup}</Text>
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.hospitalName}>{request.hospitalName}</Text>
          {request.department && (
            <Text style={styles.departmentText}>{request.department}</Text>
          )}
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Icon name="local-hospital" size={18} color="#666" />
          <Text style={styles.detailText}>
            {request.distance ? `${request.distance.toFixed(1)} km away` : 'Location available'}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Icon name="opacity" size={18} color="#666" />
          <Text style={styles.detailText}>
            {request.quantity ? `${request.quantity} units needed` : 'Quantity needed'}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Icon name="access-time" size={18} color="#666" />
          <Text style={styles.detailText}>
            {formatDate(request.createdAt)}
          </Text>
        </View>

        {timeRemaining && (
          <View style={styles.detailRow}>
            <Icon name="hourglass-empty" size={18} color="#ff9800" />
            <Text style={[styles.detailText, styles.timeRemainingText]}>
              {timeRemaining}
            </Text>
          </View>
        )}

        {request.patientName && (
          <View style={styles.detailRow}>
            <Icon name="person" size={18} color="#666" />
            <Text style={styles.detailText}>
              Patient: {request.patientName}
            </Text>
          </View>
        )}
      </View>

      {request.additionalNotes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Notes:</Text>
          <Text style={styles.notesText}>{request.additionalNotes}</Text>
        </View>
      )}

      {footerText && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{footerText}</Text>
        </View>
      )}

      {showRespondButton && (
        <TouchableOpacity
          style={[
            styles.respondButton,
            { backgroundColor: getUrgencyColor(request.urgency) }
          ]}
          onPress={() => onRespond && onRespond(request)}
        >
          <Icon name="favorite" size={20} color="#fff" />
          <Text style={styles.respondButtonText}>I Can Donate</Text>
        </TouchableOpacity>
      )}

      {request.responses && request.responses.length > 0 && (
        <View style={styles.responseCount}>
          <Icon name="people" size={14} color="#999" />
          <Text style={styles.responseCountText}>
            {request.responses.length} donor{request.responses.length !== 1 ? 's' : ''} responded
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  rareBadge: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rareText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  bloodGroupSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bloodGroupCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#d32f2f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bloodGroupText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  requestInfo: {
    flex: 1,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  departmentText: {
    fontSize: 14,
    color: '#666',
  },
  details: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  timeRemainingText: {
    color: '#ff9800',
    fontWeight: '500',
  },
  notesContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#666',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  respondButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  responseCount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  responseCountText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 6,
  },
});