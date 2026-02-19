import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { initiateGoogleLogin, getCurrentAuthToken, saveAuthToken } from '../services/api';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkExistingAuth();
    setupDeepLinkListener();
  }, []);

  const checkExistingAuth = async () => {
    const token = await getCurrentAuthToken();
    if (token) {
      // User already logged in, go to main screen
      router.replace('/');
    }
    setCheckingAuth(false);
  };

  const setupDeepLinkListener = () => {
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  };

  const handleDeepLink = ({ url }: { url: string }) => {
    console.log('Deep link received:', url);
    if (url.includes('login-callback')) {
      const parsedUrl = Linking.parse(url);
      const token = parsedUrl.queryParams?.token as string;
      console.log('Deep link - token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
      
      if (token) {
        console.log('Token from deep link, calling handleLoginSuccess');
        handleLoginSuccess(token);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      console.log('Starting Google Sign In...');
      const authData = await initiateGoogleLogin();
      
      if (!authData || !authData.auth_url) {
        throw new Error('Failed to get authorization URL');
      }

      const redirectUrl = Linking.createURL('login-callback');
      console.log('Opening auth session with redirectUrl:', redirectUrl);
      
      // Open browser for OAuth
      const result = await WebBrowser.openAuthSessionAsync(
        authData.auth_url,
        redirectUrl
      );

      console.log('Auth session result type:', result.type);
      console.log('Auth session URL:', result.url);

      if (result.type === 'success' && result.url) {
        console.log('Auth session success - URL:', result.url);
        const parsedUrl = Linking.parse(result.url);
        console.log('Parsed URL params:', JSON.stringify(parsedUrl.queryParams));
        const token = parsedUrl.queryParams?.token as string;
        
        if (token) {
          console.log('Token extracted from success URL:', token.substring(0, 20) + '...');
          await handleLoginSuccess(token);
        } else {
          console.error('No token in success URL params');
          // On web, the backend might redirect directly to login-callback
          // so we wait for it to be handled
          setLoading(false);
        }
      } else if (result.type === 'dismiss' || result.type === 'cancel') {
        console.log('Auth session dismissed/cancelled');
        // The browser session was closed - token might come via login-callback redirect
        // Just close loading state and let the deep link handler take over
        setLoading(false);
      } else {
        console.log('Auth session result type:', result.type, 'URL:', result.url);
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  const handleLoginSuccess = async (token: string) => {
    try {
      console.log('Saving token and redirecting...');
      await saveAuthToken(token);
      console.log('Token saved, navigating to home...');
      // Use router.replace without alert to navigate immediately
      router.replace('/');
    } catch (error: any) {
      console.error('Error saving token:', error);
      Alert.alert('Error', 'Failed to save login session');
      setLoading(false);
    }
  };

  const handleSkipSignIn = () => {
    router.replace('/');
  };

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D946B2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Header */}
        <View style={styles.header}>
          <Text style={styles.title}>VowSelect</Text>
          <Text style={styles.subtitle}>
            Choose your perfect wedding photos together
          </Text>
        </View>

        {/* Sign in buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Image
                  source={{ uri: 'https://www.google.com/favicon.ico' }}
                  style={styles.googleIcon}
                />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipSignIn}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip sign in</Text>
          </TouchableOpacity>
        </View>

        {/* Benefits */}
        <View style={styles.benefits}>
          <Text style={styles.benefitsTitle}>With Google sign in:</Text>
          <Text style={styles.benefitItem}>• Import photos from Google Drive</Text>
          <Text style={styles.benefitItem}>• Save selections to Drive</Text>
          <Text style={styles.benefitItem}>• Access your rooms on any device</Text>
          <Text style={styles.benefitItem}>• Never lose your selections</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F7',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#D946B2',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  googleIcon: {
    width: 24,
    height: 24,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D946B2',
  },
  skipButtonText: {
    color: '#D946B2',
    fontSize: 16,
    fontWeight: '600',
  },
  benefits: {
    marginTop: 48,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  benefitItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
});
