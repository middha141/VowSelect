import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRankings, exportPhotos } from '../../services/api';
import { photoCache } from '../../services/photoCache';
import { PhotoRanking } from '../../types';

export default function RankingsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const roomId = Array.isArray(id) ? id[0] : id;

  const [rankings, setRankings] = useState<PhotoRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [topN, setTopN] = useState('10');
  const [exportType, setExportType] = useState<'local' | 'drive'>('local');
  const [exportPath, setExportPath] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [fullScreenIndex, setFullScreenIndex] = useState<number | null>(null);

  // Swipe animation for full-screen viewer
  const fullScreenPan = useRef(new Animated.ValueXY()).current;
  const fullScreenPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 15 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_, gesture) => {
        fullScreenPan.setValue({ x: gesture.dx, y: 0 });
      },
      onPanResponderRelease: (_, gesture) => {
        const SWIPE_THRESHOLD = 80;
        if (gesture.dx < -SWIPE_THRESHOLD) {
          // Swiped left → next photo
          Animated.timing(fullScreenPan, {
            toValue: { x: -SCREEN_WIDTH, y: 0 },
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setFullScreenIndex((prev) => {
              if (prev === null) return null;
              return prev < rankings.length - 1 ? prev + 1 : prev;
            });
            fullScreenPan.setValue({ x: 0, y: 0 });
          });
        } else if (gesture.dx > SWIPE_THRESHOLD) {
          // Swiped right → previous photo
          Animated.timing(fullScreenPan, {
            toValue: { x: SCREEN_WIDTH, y: 0 },
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setFullScreenIndex((prev) => {
              if (prev === null) return null;
              return prev > 0 ? prev - 1 : prev;
            });
            fullScreenPan.setValue({ x: 0, y: 0 });
          });
        } else {
          // Snap back
          Animated.spring(fullScreenPan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const fullScreenPhoto = fullScreenIndex !== null ? rankings[fullScreenIndex] : null;

  useEffect(() => {
    loadRankings();
    loadDriveToken();
  }, []);

  // Check for token when returning from OAuth (mobile deep link)
  useEffect(() => {
    const checkForNewToken = setInterval(() => {
      loadDriveToken();
    }, 1000);

    return () => clearInterval(checkForNewToken);
  }, []);

  const loadDriveToken = async () => {
    try {
      const token = await AsyncStorage.getItem('driveAccessToken');
      if (token) {
        setDriveAccessToken(token);
      }
    } catch (error) {
      console.error('Failed to load Drive token:', error);
    }
  };

  const loadRankings = async () => {
    try {
      // Show cached rankings instantly while fetching fresh data
      const cached = photoCache.getRankings(roomId as string);
      if (cached && cached.length > 0) {
        setRankings(cached);
        setLoading(false);
      }

      const data = await getRankings(roomId as string);
      setRankings(data);

      // Cache for future navigations
      photoCache.setRankings(roomId as string, data);
      photoCache.cachePhotos(roomId as string, data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load rankings');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const n = parseInt(topN);
    if (isNaN(n) || n < 1) {
      Alert.alert('Error', 'Please enter a valid number');
      return;
    }

    if (n > rankings.length) {
      Alert.alert('Error', `Only ${rankings.length} photos available`);
      return;
    }

    // Validate based on export type
    if (exportType === 'local' && Platform.OS === 'web') {
      if (!exportPath.trim()) {
        Alert.alert('Error', 'Please enter a local folder path');
        return;
      }
    } else if (exportType === 'drive') {
      if (!driveAccessToken) {
        Alert.alert('Error', 'Please sign in with Google first');
        return;
      }
      if (!driveFolderId.trim()) {
        Alert.alert('Error', 'Please enter a Google Drive folder');
        return;
      }
    }

    try {
      setExporting(true);

      // On mobile with "local" type → download as ZIP
      if (exportType === 'local' && Platform.OS !== 'web') {
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
        const zipUrl = `${backendUrl}/api/export/download-zip?room_id=${encodeURIComponent(roomId as string)}&top_n=${n}`;
        await Linking.openURL(zipUrl);
        setExporting(false);
        setShowExportModal(false);
        return;
      }
      
      const result = await exportPhotos({
        room_id: roomId as string,
        top_n: n,
        destination_type: exportType,
        destination_path: exportType === 'local' ? exportPath : undefined,
        drive_folder_id: exportType === 'drive' ? driveFolderId : undefined,
        drive_access_token: exportType === 'drive' ? driveAccessToken ?? undefined : undefined,
      });

      // Show success message
      Alert.alert(
        'Export Complete!',
        result.message || `Successfully exported ${result.exported_count} photos`,
        [
          {
            text: 'OK',
            onPress: () => setShowExportModal(false),
          },
        ]
      );
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail || error.message || 'Failed to export photos';
      
      // Check for specific permission errors
      if (error.response?.status === 403) {
        Alert.alert(
          'Permission Error',
          errorDetail,
          [{ text: 'OK' }]
        );
      } else if (error.response?.status === 401) {
        Alert.alert(
          'Authentication Required',
          'Please sign in with Google to export to Drive',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Export Error', errorDetail);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
      const response = await fetch(`${backendUrl}/api/auth/google`);
      
      if (!response.ok) {
        const errorText = await response.text();
        Alert.alert('Backend Error', `Server returned ${response.status}: ${errorText.substring(0, 100)}`);
        return;
      }
      
      const data = await response.json();
      
      if (!data.auth_url) {
        Alert.alert('Configuration Error', 'No auth URL received from backend');
        return;
      }
      
      // For React Native/Expo: Check if we're in web or native environment
      if (typeof window !== 'undefined' && window.open) {
        // Web environment
        const authWindow = window.open(data.auth_url, 'Google Sign In', 'width=500,height=600');
        
        if (!authWindow) {
          Alert.alert('Popup Blocked', 'Please allow popups for this site to sign in with Google');
          return;
        }
        
        // Listen for message from callback window
        const messageHandler = (event: MessageEvent) => {
          if (event.data && event.data.type === 'google_auth_success' && event.data.token) {
            // Remove listener
            window.removeEventListener('message', messageHandler);
            
            // Close auth window if still open
            if (!authWindow.closed) {
              authWindow.close();
            }
            
            // Save token
            setDriveAccessToken(event.data.token);
            
            Alert.alert(
              'Success',
              'Signed in with Google! You can now export to Google Drive.'
            );
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Cleanup if window is closed manually
        const checkInterval = setInterval(() => {
          if (authWindow.closed) {
            clearInterval(checkInterval);
            window.removeEventListener('message', messageHandler);
          }
        }, 1000);
        
        // Cleanup after 5 minutes
        setTimeout(() => {
          clearInterval(checkInterval);
          window.removeEventListener('message', messageHandler);
          if (!authWindow.closed) {
            authWindow.close();
          }
        }, 5 * 60 * 1000);
      } else {
        // React Native environment - use openAuthSessionAsync for OAuth
        const redirectUrl = 'vowselect://auth-callback';
        const result = await WebBrowser.openAuthSessionAsync(data.auth_url, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          // Extract token from the redirect URL
          const urlParams = new URL(result.url);
          const token = urlParams.searchParams.get('token');
          
          if (token) {
            setDriveAccessToken(token);
            await AsyncStorage.setItem('driveAccessToken', token);
            Alert.alert('Success', 'Signed in with Google! You can now export to Google Drive.');
          } else {
            // Token might have been saved by auth-callback screen via deep link
            await loadDriveToken();
          }
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          // Check if token arrived via deep link handler
          await loadDriveToken();
        }
      }
    } catch (error: any) {
      Alert.alert(
        'Sign-in Error',
        `Failed to sign in with Google.\n\nError: ${error.message}`
      );
    }
  };

  const handleGoogleSignOut = async () => {
    setDriveAccessToken(null);
    try {
      await AsyncStorage.removeItem('driveAccessToken');
    } catch (error) {
      console.error('Failed to remove Drive token:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D946B2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rankings</Text>
        <TouchableOpacity onPress={() => setShowExportModal(true)}>
          <Text style={styles.headerButton}>Export ⇆</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{rankings.length}</Text>
            <Text style={styles.statLabel}>Total Photos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>
              {rankings.filter(r => r.vote_count > 0).length}
            </Text>
            <Text style={styles.statLabel}>Voted On</Text>
          </View>
        </View>

        {rankings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No photos have been voted on yet</Text>
          </View>
        ) : (
          <View style={styles.rankingsList}>
            {rankings.map((photo, index) => (
                <View key={photo.photo_id} style={styles.rankingItem}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{photo.rank}</Text>
                  </View>
                  
                  {/* Photo Thumbnail */}
                  <TouchableOpacity onPress={() => {
                    if (photo.compressed_data) {
                      const idx = rankings.findIndex(r => r.photo_id === photo.photo_id);
                      setFullScreenIndex(idx >= 0 ? idx : null);
                    }
                  }}>
                    {photo.compressed_data ? (
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${photo.compressed_data}` }}
                        style={styles.photoThumbnail}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Text style={styles.placeholderIcon}>📷</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  <View style={styles.photoInfo}>
                    <Text style={styles.photoName} numberOfLines={1}>
                      {photo.filename}
                    </Text>
                    <Text style={styles.photoSource}>
                      {photo.source_type === 'local' ? '💾 Local' : photo.source_type === 'upload' ? '📤 Upload' : '☁️ Drive'}
                    </Text>
                  </View>
                  <View style={styles.scoreInfo}>
                    <Text style={styles.scoreValue}>
                      {photo.weighted_score.toFixed(2)}
                    </Text>
                    <Text style={styles.voteCount}>
                      {photo.vote_count} vote{photo.vote_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      {/* Full Screen Photo Modal */}
      <Modal
        visible={fullScreenIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenIndex(null)}
      >
        <View style={styles.fullScreenOverlay}>
          <Animated.View
            {...fullScreenPanResponder.panHandlers}
            style={[
              styles.fullScreenWrapper,
              { transform: [{ translateX: fullScreenPan.x }] },
            ]}
          >
            {fullScreenPhoto?.compressed_data && (
              <Image
                source={{ uri: `data:image/jpeg;base64,${fullScreenPhoto.compressed_data}` }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
            <View style={styles.fullScreenInfo}>
              <Text style={styles.fullScreenRank}>#{fullScreenPhoto?.rank}</Text>
              <Text style={styles.fullScreenFilename} numberOfLines={1}>{fullScreenPhoto?.filename}</Text>
              <Text style={styles.fullScreenScore}>
                Score: {fullScreenPhoto?.weighted_score.toFixed(2)} · {fullScreenPhoto?.vote_count} vote{fullScreenPhoto?.vote_count !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.fullScreenCounter}>
                {fullScreenIndex !== null ? fullScreenIndex + 1 : 0} / {rankings.length}
              </Text>
            </View>

            {/* Navigation arrows */}
            {fullScreenIndex !== null && fullScreenIndex > 0 && (
              <TouchableOpacity
                style={[styles.fullScreenNavButton, styles.fullScreenNavLeft]}
                onPress={() => setFullScreenIndex(fullScreenIndex - 1)}
              >
                <Text style={styles.fullScreenNavText}>‹</Text>
              </TouchableOpacity>
            )}
            {fullScreenIndex !== null && fullScreenIndex < rankings.length - 1 && (
              <TouchableOpacity
                style={[styles.fullScreenNavButton, styles.fullScreenNavRight]}
                onPress={() => setFullScreenIndex(fullScreenIndex + 1)}
              >
                <Text style={styles.fullScreenNavText}>›</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.fullScreenCloseButton}
              onPress={() => setFullScreenIndex(null)}
            >
              <Text style={styles.fullScreenCloseText}>✕</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Export Top Photos</Text>

            <Text style={styles.label}>Number of Photos</Text>
            <TextInput
              style={styles.input}
              value={topN}
              onChangeText={setTopN}
              keyboardType="number-pad"
              placeholder="Enter number"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Destination</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  exportType === 'local' && styles.toggleButtonActive,
                ]}
                onPress={() => setExportType('local')}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    exportType === 'local' && styles.toggleButtonTextActive,
                  ]}
                >
                  {Platform.OS !== 'web' ? 'Download ZIP' : 'Local Folder'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  exportType === 'drive' && styles.toggleButtonActive,
                ]}
                onPress={() => setExportType('drive')}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    exportType === 'drive' && styles.toggleButtonTextActive,
                  ]}
                >
                  Google Drive
                </Text>
              </TouchableOpacity>
            </View>

            {exportType === 'local' ? (
              Platform.OS !== 'web' ? (
                <View style={styles.zipInfo}>
                  <Text style={styles.zipInfoIcon}>📦</Text>
                  <Text style={styles.zipInfoText}>
                    Top {topN || '?'} photos will be downloaded as a ZIP file to your device
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>Local Folder Path</Text>
                  <Text style={styles.helperText}>
                    Photos will be saved to this folder on the server
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={exportPath}
                    onChangeText={setExportPath}
                    placeholder="C:\Photos\Export"
                    placeholderTextColor="#999"
                  />
                </>
              )
            ) : (
              <>
                <Text style={styles.label}>Google Drive</Text>
                {driveAccessToken ? (
                  <View style={styles.authRow}>
                    <View style={[styles.authBadge, { flex: 1 }]}>
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
                    <Text style={styles.signInButtonText}>🔑 Sign in with Google</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.label}>Drive Folder ID or URL</Text>
                <Text style={styles.helperText}>
                  A new folder will be created inside this folder
                </Text>
                <TextInput
                  style={styles.input}
                  value={driveFolderId}
                  onChangeText={setDriveFolderId}
                  placeholder="Folder ID or URL"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.primaryButton]}
                onPress={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Export</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={() => setShowExportModal(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    fontSize: 16,
    color: '#D946B2',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 24,
    gap: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#D946B2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  rankingsList: {
    padding: 16,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  rankBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FDF2F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D946B2',
  },
  photoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  photoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 24,
  },
  photoInfo: {
    flex: 1,
  },
  photoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  photoSource: {
    fontSize: 12,
    color: '#666',
  },
  scoreInfo: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 2,
  },
  voteCount: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
  },
  zipInfo: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  zipInfoIcon: {
    fontSize: 32,
  },
  zipInfoText: {
    fontSize: 14,
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    color: '#1f2937',
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#D946B2',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  modalButtons: {
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#D946B2',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
    marginTop: -8,
  },
  signInButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  authBadge: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  authBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  signOutButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  fullScreenInfo: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullScreenRank: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#D946B2',
    marginBottom: 4,
  },
  fullScreenFilename: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  fullScreenScore: {
    fontSize: 14,
    color: '#ccc',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenCloseText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  fullScreenCounter: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  fullScreenNavButton: {
    position: 'absolute',
    top: '45%',
    width: 44,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenNavLeft: {
    left: 8,
  },
  fullScreenNavRight: {
    right: 8,
  },
  fullScreenNavText: {
    fontSize: 36,
    color: '#fff',
    fontWeight: '300',
  },
});
