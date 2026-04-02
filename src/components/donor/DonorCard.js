import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function DonorCard({
  donor,
  onPress,
  onContact,
  showContactButton = false,
  showDistance = true,
  style = {}
}) {
  const getBloodGroupColor = (bloodGroup) => {
    const rareGroups = ['AB-', 'B-', 'A-', 'O-'];
    return rareGroups.includes(bloodGroup) ? '#ff9800' : '#d32f2f';
  };

  const getAvailabilityStatus = (isAvailable, lastDonationDate) => {
    if (!isAvailable) return { text: 'Not Available', color: '#999' };
    
    if (lastDonationDate) {
      const lastDonation = new Date(lastDonationDate);
      const now = new Date();
      const daysSince = Math.floor((now - lastDonation) / (1000 * 60 * 60 * 24));
      
      if (daysSince < 90) {
        const daysLeft = 90 - daysSince;
        return { text: `Available in ${daysLeft} days`, color: '#ff9800' };
      }
    }
    
    return { text: 'Available Now', color: '#4caf50' };
  };

  const getDonationStats = (totalDonations) => {
    if (totalDonations >= 20) return '🌟 Gold Donor';
    if (totalDonations >= 10) return '⭐ Silver Donor';
    if (totalDonations >= 5) return '🩸 Bronze Donor';
    return '💪 First Time Donor';
  };

  const formatDistance = (distance) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m away`;
    }
    return `${distance.toFixed(1)}km away`;
  };

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {donor.avatar ? (
            <Image source={{ uri: donor.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: getBloodGroupColor(donor.bloodGroup) }]}>
              <Text style={styles.avatarText}>
                {donor.name ? donor.name.charAt(0).toUpperCase() : 'D'}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.donorInfo}>
          <Text style={styles.donorName}>{donor.name || 'Anonymous Donor'}</Text>
          <View style={styles.bloodGroupContainer}>
            <View style={[styles.bloodGroupBadge, { backgroundColor: getBloodGroupColor(donor.bloodGroup) }]}>
              <Text style={styles.bloodGroupText}>{donor.bloodGroup}</Text>
            </View>
            <Text style={styles.donorType}>{getDonationStats(donor.totalDonations || 0)}</Text>
          </View>
        </View>
        
        {showDistance && donor.distance && (
          <View style={styles.distanceContainer}>
            <Icon name="location-on" size={16} color="#666" />
            <Text style={styles.distanceText}>{formatDistance(donor.distance)}</Text>
          </View>
        )}
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Icon name="favorite" size={18} color="#d32f2f" />
          <Text style={styles.detailText}>
            Total Donations: {donor.totalDonations || 0}
          </Text>
        </View>
        
        {donor.lastDonationDate && (
          <View style={styles.detailItem}>
            <Icon name="update" size={18} color="#666" />
            <Text style={styles.detailText}>
              Last Donation: {new Date(donor.lastDonationDate).toLocaleDateString()}
            </Text>
          </View>
        )}
        
        <View style={styles.detailItem}>
          <Icon name="verified-user" size={18} color={donor.verified ? '#4caf50' : '#999'} />
          <Text style={styles.detailText}>
            {donor.verified ? 'Verified Donor' : 'Verification Pending'}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getAvailabilityStatus(donor.isAvailable, donor.lastDonationDate).color }]} />
          <Text style={[styles.statusText, { color: getAvailabilityStatus(donor.isAvailable, donor.lastDonationDate).color }]}>
            {getAvailabilityStatus(donor.isAvailable, donor.lastDonationDate).text}
          </Text>
        </View>
        
        {showContactButton && (
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => onContact && onContact(donor)}
          >
            <Icon name="call" size={20} color="#fff" />
            <Text style={styles.contactButtonText}>Contact</Text>
          </TouchableOpacity>
        )}
      </View>

      {donor.bio && (
        <View style={styles.bioContainer}>
          <Text style={styles.bioText} numberOfLines={2}>
            {donor.bio}
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
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  donorInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  donorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  bloodGroupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  bloodGroupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  bloodGroupText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  donorType: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: '500',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  details: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4caf50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  bioContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  bioText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});