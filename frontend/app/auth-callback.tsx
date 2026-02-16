/** @jsxRuntime automatic */
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      console.log('Auth Callback - Params:', params);
      
      const token = Array.isArray(params.token) ? params.token[0] : params.token;
      
      if (!token) {
        Alert.alert('Error', 'No token received from authentication');
        router.dismiss();
        return;
      }

      console.log('Token received:', token.substring(0, 20) + '...');

      // Save token to AsyncStorage
      await AsyncStorage.setItem('driveAccessToken', token);
      console.log('Token saved to AsyncStorage');

      Alert.alert(
        'Success',
        'Signed in with Google! You can now import photos from Google Drive.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.dismiss();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Auth callback error:', error);
      Alert.alert('Error', `Failed to process authentication: ${error.message}`);
      router.dismiss();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5F7' }}>
      <ActivityIndicator size="large" color="#D946B2" />
      <Text style={{ marginTop: 16, color: '#666', fontSize: 16 }}>
        Processing authentication...
      </Text>
    </View>
  );
}
