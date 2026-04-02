export const APP_CONSTANTS = {
  APP_NAME: 'Blood Donor App',
  DEFAULT_RADIUS: 3,
  RARE_BLOOD_RADIUS: 5,
  MAX_DONATION_AGE: 65,
  MIN_DONATION_AGE: 18,
  DONATION_INTERVAL_DAYS: 90, // Days between donations
  REQUEST_EXPIRY_HOURS: 24,
};

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const URGENCY_LEVELS = {
  NORMAL: 'normal',
  HIGH: 'high',
  EMERGENCY: 'emergency',
};

export const REQUEST_STATUS = {
  ACTIVE: 'active',
  FULFILLED: 'fulfilled',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

export const USER_TYPES = {
  DONOR: 'donor',
  HOSPITAL: 'hospital',
};