import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../context/AuthContext';

// Donor Screens
import DonorHomeScreen from '../screens/donor/HomeScreen';
import NearbyRequestScreen from '../screens/donor/NearbyRequestScreen';
import ProfileScreen from '../screens/donor/ProfileScreen';
import DonationHistoryScreen from '../screens/donor/DonationHistoryScreen';

// Hospital Screens
import HospitalDashboard from '../screens/hospital/HospitalDashboard';
import CreateBloodRequest from '../screens/hospital/CreateBloodRequest';
import RequestStatusScreen from '../screens/hospital/RequestStatusScreen';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function DonorTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Nearby') {
            iconName = 'location-on';
          } else if (route.name === 'History') {
            iconName = 'history';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#d32f2f',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={DonorHomeScreen} />
      <Tab.Screen name="Nearby" component={NearbyRequestScreen} />
      <Tab.Screen name="History" component={DonationHistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function HospitalStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Dashboard" 
        component={HospitalDashboard} 
        options={{ title: 'Hospital Dashboard' }}
      />
      <Stack.Screen 
        name="CreateRequest" 
        component={CreateBloodRequest} 
        options={{ title: 'Create Blood Request' }}
      />
      <Stack.Screen 
        name="RequestStatus" 
        component={RequestStatusScreen} 
        options={{ title: 'Request Status' }}
      />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, userType, loading } = useAuth();

  if (loading) {
    return null; // Or a splash screen
  }

  if (!user) {
    return <AuthStack />;
  }

  return userType === 'donor' ? <DonorTabs /> : <HospitalStack />;
}