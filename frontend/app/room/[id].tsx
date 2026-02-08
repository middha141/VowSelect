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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { getRoom, getRoomParticipants, importPhotos, getCurrentUser } from '../../services/api';
import { Room as RoomType, RoomParticipant } from '../../types';
import axios from 'axios';

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
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveAccessToken, setDriveAccessToken] = useState('');

  const roomId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    loadRoomData();
    loadUser();
  }, []);

  const loadUser = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
  };

  const loadRoomData = async () => {
    try {
      const data = await getRoom(roomId as string);
      setRoom(data.room);
      setPhotoCount(data.photo_count);

      const participantsData = await getRoomParticipants(roomId as string);
      setParticipants(participantsData.participants);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load room');
    } finally {
      setLoading(false);
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

      Alert.alert('Success', `Imported ${result.imported_count} photos from folder`);
      setLocalFolderPath('');
      loadRoomData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || error.message || 'Failed to import photos');
    } finally {
      setImporting(false);
    }
  };

  const handleImportDrive = async () => {
    if (!driveFolderId.trim()) {
      Alert.alert('Error', 'Please enter Google Drive folder ID');
      return;
    }

    if (!driveAccessToken.trim()) {
      Alert.alert('Error', 'Please enter Google Drive access token');
      return;
    }

    try {
      setImporting(true);
      
      const result = await importPhotos({
        room_id: roomId as string,
        source_type: 'drive',
        drive_folder_id: driveFolderId.trim(),
        drive_access_token: driveAccessToken.trim(),
      });

      Alert.alert('Success', `Imported ${result.imported_count} photos from Google Drive`);
      setDriveFolderId('');
      setDriveAccessToken('');
      loadRoomData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || error.message || 'Failed to import from Drive');
    } finally {
      setImporting(false);
    }
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
    <ScrollView style={styles.container}>
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
        <Text style={styles.sectionTitle}>👥 Participants ({participants.length})</Text>
        <View style={styles.participantsList}>
          {participants.map((p, idx) => (
            <View key={idx} style={styles.participantItem}>
              <Text style={styles.participantName}>{p.username}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📸 Photos ({photoCount})</Text>

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

        <Text style={styles.importLabel}>Local Files</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter folder path (e.g., /photos/wedding)"
          value={localFolderPath}
          onChangeText={setLocalFolderPath}
          placeholderTextColor="#999"
        />
        <Text style={styles.helperText}>📁 Will scan folder recursively for all image files</Text>
        <TouchableOpacity
          style={[styles.importButton, importing && styles.buttonDisabled]}
          onPress={handleImportLocal}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.importButtonText}>Import Local Photos</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.importLabel}>Google Drive</Text>
        <TextInput
          style={styles.input}
          placeholder="Google Drive Folder ID"
          value={driveFolderId}
          onChangeText={setDriveFolderId}
          placeholderTextColor="#999"
        />
        <TextInput
          style={styles.input}
          placeholder="Google Drive Access Token"
          value={driveAccessToken}
          onChangeText={setDriveAccessToken}
          secureTextEntry
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={[styles.importButton, importing && styles.buttonDisabled]}
          onPress={handleImportDrive}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.importButtonText}>Import from Google Drive</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
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
});
