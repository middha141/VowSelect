/** @jsxRuntime automatic */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRoom, getRoomParticipants, importPhotos, getCurrentUser, getImportJobStatus } from '../../services/api';
import { Room as RoomType, RoomParticipant } from '../../types';

export default function RoomScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [room, setRoom] = useState<RoomType | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Local import
  const [localFolderPath, setLocalFolderPath] = useState('');

  // Google Drive import
  const [driveFolderUrl, setDriveFolderUrl] = useState('');
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);

  // Import progress tracking
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{
    status: string;
    processed: number;
    total: number;
    ready: number;
    failed?: number;
  } | null>(null);
  const [expectedTotal, setExpectedTotal] = useState<number | null>(null);

  const roomId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    loadRoomData();
    loadUser();
    loadDriveToken();
  }, []);

  // Check for token when returning from OAuth (mobile deep link)
  useEffect(() => {
    const checkForNewToken = setInterval(() => {
      loadDriveToken();
    }, 1000);

    return () => clearInterval(checkForNewToken);
  }, []);

  // Auto-refresh room data every 5s when an import is active (covers returning to page mid-import)
  useEffect(() => {
    if (!importing && !importJobId) return;

    const interval = setInterval(() => {
      loadRoomData();
    }, 5000);

    return () => clearInterval(interval);
  }, [importing, importJobId]);

  useEffect(() => {
    console.log('driveAccessToken changed:', driveAccessToken ? 'Token present (length: ' + driveAccessToken.length + ')' : 'No token');
  }, [driveAccessToken]);

  // Poll import job progress when a background import is running
  useEffect(() => {
    if (!importJobId) return;

    const interval = setInterval(async () => {
      try {
        const data = await getImportJobStatus(importJobId);
        const job = data.job;
        const ready = data.ready_photo_count ?? 0;

        setImportProgress({
          status: job.status,
          processed: job.processed_photos ?? 0,
          total: job.total_photos ?? 0,
          ready,
          failed: job.failed_photos ?? 0,
        });

        // Refresh photo count in the room header
        setPhotoCount(ready);

        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(interval);
          setImportJobId(null);
          setImporting(false);
          setExpectedTotal(null);
          setImportProgress(null);
          loadRoomData();

          if (job.status === 'completed') {
            Alert.alert('Import Complete', `All ${job.processed_photos} photos are ready!`);
          } else {
            Alert.alert('Import Issue', `Imported ${job.processed_photos} photos. ${job.failed_photos ?? 0} failed.`);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [importJobId]);

  const loadUser = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
  };

  const loadDriveToken = async () => {
    try {
      const token = await AsyncStorage.getItem('driveAccessToken');
      if (token && token !== driveAccessToken) {
        console.log('Drive token loaded from AsyncStorage');
        setDriveAccessToken(token);
      }
    } catch (error) {
      console.error('Failed to load Drive token:', error);
    }
  };

  const loadRoomData = async () => {
    try {
      const data = await getRoom(roomId as string);
      setRoom(data.room);
      setPhotoCount(data.photo_count);

      // If there's an active import job, resume polling
      if (data.importing && data.import_job) {
        const job = data.import_job;
        setExpectedTotal(job.total_photos);

        // Resume polling if we don't already have one running
        if (!importJobId) {
          setImportJobId(job.job_id);
          setImporting(true);
          setImportProgress({
            status: job.status,
            processed: job.processed_photos ?? 0,
            total: job.total_photos ?? 0,
            ready: data.photo_count,
            failed: job.failed_photos ?? 0,
          });
        }
      } else {
        setExpectedTotal(null);
      }

      const participantsData = await getRoomParticipants(roomId as string);
      setParticipants(participantsData?.participants || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load room');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await AsyncStorage.removeItem('driveAccessToken');
      setDriveAccessToken(null);
      Alert.alert('Signed Out', 'You have been signed out of Google Drive');
    } catch (error) {
      console.error('Failed to sign out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleImportLocal = async () => {
    if (!localFolderPath.trim()) {
      Alert.alert('Error', 'Please enter a folder path');
      return;
    }

    try {
      setImporting(true);
      
      const result = await importPhotos({
        room_id: roomId as string,
        source_type: 'local',
        folder_path: localFolderPath.trim(),
      });

      Alert.alert('Success', `Imported ${result.imported_count} photos from local folder`);
      setLocalFolderPath('');
      loadRoomData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || error.message || 'Failed to import from local folder');
    } finally {
      setImporting(false);
    }
  };

  const handleImportDrive = async () => {
    console.log('handleImportDrive called');
    console.log('Drive folder URL:', driveFolderUrl);
    console.log('Drive access token:', driveAccessToken ? 'Present' : 'Missing');
    
    if (!driveFolderUrl.trim()) {
      Alert.alert('Error', 'Please enter Google Drive folder URL or ID');
      return;
    }

    if (!driveAccessToken) {
      console.log('No token available - should not reach here');
      return;
    }

    try {
      setImporting(true);
      
      // Extract folder ID from URL if it's a full URL
      let folderId = driveFolderUrl.trim();
      const urlMatch = driveFolderUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
      if (urlMatch) {
        folderId = urlMatch[1];
      }
      
      const result = await importPhotos({
        room_id: roomId as string,
        source_type: 'drive',
        drive_folder_id: folderId,
        drive_access_token: driveAccessToken,
      });

      if (result.status === 'processing' && result.job_id) {
        // Background import started — kick off polling
        setImportJobId(result.job_id);
        setExpectedTotal(result.total_found ?? 0);
        setImportProgress({
          status: 'processing',
          processed: result.imported_count ?? 0,
          total: result.total_found ?? 0,
          ready: result.imported_count ?? 0,
        });
        setPhotoCount(result.imported_count ?? 0);
        setDriveFolderUrl('');
        // Don't setImporting(false) yet — polling will do that when done
        return;
      }

      // Small folder — everything imported synchronously
      Alert.alert('Success', `Imported ${result.imported_count} photos from Google Drive`);
      setDriveFolderUrl('');
      setImporting(false);
      loadRoomData();
    } catch (error: any) {
      // Check if error is due to authentication issues
      if (error.response?.status === 401 || error.response?.data?.detail?.includes('auth')) {
        setDriveAccessToken(null); // Clear invalid token
        Alert.alert(
          'Authentication Required',
          'Your session has expired. Please sign in again.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign in with Google',
              onPress: () => {
                console.log('Retry auth button clicked');
                handleGoogleSignIn();
              }
            },
          ]
        );
      } else {
        Alert.alert('Error', error.response?.data?.detail || error.message || 'Failed to import from Drive');
      }
    } finally {
      setImporting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('=== handleGoogleSignIn START ===');
    
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

    if (typeof window !== 'undefined' && window.open) {
      // Web environment — open popup directly to the backend redirect endpoint.
      // This avoids about:blank which browsers close immediately.
      const authWindow = window.open(
        `${backendUrl}/api/auth/google/redirect`,
        'Google Sign In',
        'width=500,height=600'
      );
      
      if (!authWindow) {
        Alert.alert('Popup Blocked', 'Please allow popups for this site to sign in with Google');
        return;
      }
      
      console.log('Popup opened, waiting for postMessage from callback...');
      
      // Listen for message from callback window
      const messageHandler = (event: MessageEvent) => {
        if (event.data && event.data.type === 'google_auth_success' && event.data.token) {
          console.log('Token received via postMessage!');
          window.removeEventListener('message', messageHandler);
          if (!authWindow.closed) {
            authWindow.close();
          }
          setDriveAccessToken(event.data.token);
          AsyncStorage.setItem('driveAccessToken', event.data.token);
          Alert.alert(
            'Success',
            'Signed in with Google! You can now import photos from Google Drive.'
          );
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Clean up after 5 minutes
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        if (!authWindow.closed) {
          authWindow.close();
        }
      }, 5 * 60 * 1000);
    } else {
      // React Native environment - fetch auth URL then use WebBrowser
      try {
        const response = await fetch(`${backendUrl}/api/auth/google`);
        if (!response.ok) {
          Alert.alert('Backend Error', `Server returned ${response.status}`);
          return;
        }
        const data = await response.json();
        if (!data.auth_url) {
          Alert.alert('Configuration Error', 'No auth URL received from backend');
          return;
        }
        
        const redirectUrl = 'vowselect://auth-callback';
        const result = await WebBrowser.openAuthSessionAsync(data.auth_url, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          const urlParams = new URL(result.url);
          const token = urlParams.searchParams.get('token');
          
          if (token) {
            setDriveAccessToken(token);
            await AsyncStorage.setItem('driveAccessToken', token);
            Alert.alert('Success', 'Signed in with Google! You can now import photos from Google Drive.');
          } else {
            await loadDriveToken();
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          await loadDriveToken();
        }
      } catch (error: any) {
        console.error('Google sign-in error:', error.message);
        Alert.alert(
          'Sign-in Error',
          `Failed to sign in with Google.\n\nError: ${error.message}`
        );
      }
    }
    
    console.log('=== handleGoogleSignIn END ===');
  };

  const handleStartVoting = () => {
    if (photoCount === 0) {
      Alert.alert('No Photos', 'Please import photos first');
      return;
    }
    router.push(`/swipe/${roomId}`);
  };

  const handleViewRankings = () => {
    router.push(`/rankings/${roomId}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D946B2" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Room Code</Text>
            <Text style={styles.code}>{room?.code}</Text>
          </View>
          {currentUser && (
            <View style={styles.userBadge}>
              <Text style={styles.userBadgeText}>👤 {currentUser.username}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👥 Participants ({(participants || []).length})</Text>
        <View style={styles.participantsList}>
          {(participants || []).map((p, idx) => (
            <View key={idx} style={styles.participantItem}>
              <Text style={styles.participantName}>{p.username}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          📸 Photos ({photoCount}{expectedTotal && expectedTotal > photoCount ? ` / ${expectedTotal} expected` : ''})
        </Text>

        {/* Import progress indicator */}
        {importProgress && importProgress.status === 'processing' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <ActivityIndicator size="small" color="#D946B2" />
              <Text style={styles.progressTitle}>Importing from Google Drive...</Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: importProgress.total > 0
                      ? `${Math.round((importProgress.processed / importProgress.total) * 100)}%`
                      : '0%',
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {importProgress.processed} / {importProgress.total} photos processed
              {importProgress.ready !== undefined && importProgress.ready !== importProgress.processed
                ? ` (${importProgress.ready} ready)`
                : ''}
              {importProgress.failed ? ` · ${importProgress.failed} failed` : ''}
            </Text>
          </View>
        )}

        {photoCount > 0 && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartVoting}>
              <Text style={styles.primaryButtonText}>Start Voting</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleViewRankings}>
              <Text style={styles.secondaryButtonText}>View Rankings</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📥 Import Photos</Text>

        {Platform.OS === 'web' && (
          <>
            <Text style={styles.importLabel}>Local Folder</Text>
            <Text style={styles.helperText}>📁 Enter the folder path on the server (e.g., C:\Photos\MyAlbum)</Text>
            <TextInput
              style={styles.input}
              placeholder="Folder path (e.g., C:\Photos\MyAlbum)"
              value={localFolderPath}
              onChangeText={setLocalFolderPath}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={[styles.importButton, importing && styles.buttonDisabled]}
              onPress={handleImportLocal}
              disabled={importing}
            >
              {importing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.importButtonText}>📂 Import from Folder</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider} />
          </>
        )}

        <Text style={styles.importLabel}>Google Drive</Text>
        <Text style={styles.helperText}>☁️ Paste the Google Drive folder URL or ID</Text>
        <Text style={styles.helperTextSmall}>Note: Drive imports require Google sign-in to download photos (even for public folders).</Text>
        {driveAccessToken ? (
          <View style={styles.authContainer}>
            <View style={styles.authBadge}>
              <Text style={styles.authBadgeText}>✓ Signed in with Google</Text>
            </View>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleGoogleSignOut}
            >
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleGoogleSignIn}
          >
            <Text style={styles.signInButtonText}>🔑 Sign in with Google First</Text>
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.input}
          placeholder="https://drive.google.com/drive/folders/... or folder ID"
          value={driveFolderUrl}
          onChangeText={setDriveFolderUrl}
          placeholderTextColor="#999"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[
            styles.importButton,
            (importing || !driveAccessToken) && styles.buttonDisabled
          ]}
          onPress={handleImportDrive}
          disabled={importing || !driveAccessToken}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.importButtonText}>
              {driveAccessToken ? '☁️ Import from Google Drive' : '🔒 Sign in First to Import'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
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
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  code: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#D946B2',
  },
  userBadge: {
    backgroundColor: '#FDF2F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  userBadgeText: {
    fontSize: 14,
    color: '#D946B2',
    fontWeight: '600',
  },
  section: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  participantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  participantName: {
    fontSize: 14,
    color: '#1f2937',
  },
  actionButtons: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#D946B2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D946B2',
  },
  secondaryButtonText: {
    color: '#D946B2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  importLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 12,
    color: '#1f2937',
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  helperTextSmall: {
    fontSize: 11,
    color: '#999',
    marginBottom: 12,
    lineHeight: 16,
  },
  authContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  authBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  authBadgeText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D946B2',
  },
  signOutButtonText: {
    color: '#D946B2',
    fontSize: 12,
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  importButton: {
    backgroundColor: '#EC4899',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  importButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 24,
  },
  backButton: {
    margin: 24,
    alignItems: 'center',
    padding: 16,
  },
  backButtonText: {
    color: '#D946B2',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    backgroundColor: '#FDF2F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F9A8D4',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D946B2',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#D946B2',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
  },
});