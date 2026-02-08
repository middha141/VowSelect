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
  Modal,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { getRankings, exportPhotos, getRoomPhotos } from '../../services/api';
import { PhotoRanking, Photo } from '../../types';

export default function RankingsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const roomId = Array.isArray(id) ? id[0] : id;

  const [rankings, setRankings] = useState<PhotoRanking[]>([]);
  const [photosMap, setPhotosMap] = useState<Map<string, Photo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [topN, setTopN] = useState('10');
  const [exportType, setExportType] = useState<'local' | 'drive'>('local');
  const [exportPath, setExportPath] = useState('/path/to/export');

  useEffect(() => {
    loadRankings();
  }, []);

  const loadRankings = async () => {
    try {
      const data = await getRankings(roomId as string);
      setRankings(data);
      
      // Also fetch full photo data to get base64
      const photosData = await getRoomPhotos(roomId as string, 0, 100);
      const photoMap = new Map(photosData.photos.map((p: Photo) => [p._id || p.id || '', p]));
      setPhotosMap(photoMap);
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

    try {
      setExporting(true);
      const result = await exportPhotos({
        room_id: roomId as string,
        top_n: n,
        destination_type: exportType,
        destination_path: exportPath,
      });

      // Show CSV report
      Alert.alert(
        'Export Complete',
        `Exported top ${n} photos\n\nCSV Report:\n${result.csv_report}`,
        [
          {
            text: 'OK',
            onPress: () => setShowExportModal(false),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to export photos');
    } finally {
      setExporting(false);
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
                <View style={styles.photoInfo}>
                  <Text style={styles.photoName} numberOfLines={1}>
                    {photo.filename}
                  </Text>
                  <Text style={styles.photoSource}>
                    {photo.source_type === 'local' ? '💾 Local' : '☁️ Drive'}
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

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
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
                  Local
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

            <Text style={styles.label}>Export Path</Text>
            <TextInput
              style={styles.input}
              value={exportPath}
              onChangeText={setExportPath}
              placeholder="/path/to/export"
              placeholderTextColor="#999"
            />

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
        </View>
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
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
});
