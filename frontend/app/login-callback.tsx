import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { saveAuthToken } from '../services/api';

export default function LoginCallbackScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      console.log('=== Login Callback Screen ===');
      console.log('Raw params:', params);
      const token = Array.isArray(params.token) ? params.token[0] : params.token;
      console.log('Extracted token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
      
      if (!token) {
        console.error('No token received in login-callback');
        setLoading(false);
        // Wait a moment then go home
        setTimeout(() => {
          router.replace('/');
        }, 1000);
        return;
      }

      console.log('💾 Saving token to storage...');
      await saveAuthToken(token);
      console.log('✅ Token saved successfully, waiting for flush...');
      
      // Small delay to ensure AsyncStorage write is persisted
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('📱 Navigating to home screen...');
      router.replace('/');
    } catch (error: any) {
      console.error('❌ Login callback error:', error);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5F7' }}>
      <ActivityIndicator size="large" color="#D946B2" />
      <Text style={{ marginTop: 16, color: '#666', fontSize: 16 }}>
        Completing sign in...
      </Text>
    </View>
  );
}
