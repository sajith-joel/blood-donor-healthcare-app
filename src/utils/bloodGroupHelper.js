export const RARE_BLOOD_GROUPS = ['AB-', 'B-', 'A-', 'O-'];

export const isRareBloodGroup = (bloodGroup) => {
  return RARE_BLOOD_GROUPS.includes(bloodGroup);
};

export const getBloodGroupCompatibility = (donorBloodGroup, recipientBloodGroup) => {
  const compatibility = {
    'O-': ['O-'],
    'O+': ['O+', 'O-'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
  };
  return compatibility[donorBloodGroup]?.includes(recipientBloodGroup) || false;
};

export const getNotificationRadius = (bloodGroup) => {
  return isRareBloodGroup(bloodGroup) ? 5 : 3; // 5km for rare, 3km for common
};