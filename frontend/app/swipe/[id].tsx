import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRoomPhotos, createVote, undoVote, getCurrentUser, getUserVotes } from '../../services/api';
import { Photo } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

export default function SwipeScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const roomId = Array.isArray(id) ? id[0] : id;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [votedPhotos, setVotedPhotos] = useState<Set<string>>(new Set());
  const [showScoreButtons, setShowScoreButtons] = useState<'left' | 'right' | null>(null);

  const position = useRef(new Animated.ValueXY()).current;
  const [swiping, setSwiping] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);

      const photosData = await getRoomPhotos(roomId as string, 0, 500);
      setPhotos(photosData.photos);

      // Get user's votes to determine starting point
      const votesData = await getUserVotes(roomId as string, user.userId);
      const votedPhotoIds = new Set(votesData.votes.map((v: any) => v.photo_id));
      setVotedPhotos(votedPhotoIds);

      // Find first unvoted photo
      const firstUnvotedIndex = photosData.photos.findIndex(
        (p: Photo) => !votedPhotoIds.has(p._id || p.id || '')
      );
      if (firstUnvotedIndex >= 0) {
        setCurrentIndex(firstUnvotedIndex);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setSwiping(true);
        position.setOffset({
          x: (position.x as any)._value,
          y: (position.y as any)._value,
        });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
        
        // Show score buttons based on swipe direction
        if (Math.abs(gesture.dx) > 50) {
          if (gesture.dx > 0) {
            setShowScoreButtons('right');
          } else {
            setShowScoreButtons('left');
          }
        } else {
          setShowScoreButtons(null);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        position.flattenOffset();
        setSwiping(false);

        if (Math.abs(gesture.dx) > SWIPE_THRESHOLD) {
          // Swiped enough - show score selection
          const direction = gesture.dx > 0 ? 'right' : 'left';
          setShowScoreButtons(direction);
        } else {
          // Reset position
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
          setShowScoreButtons(null);
        }
      },
    })
  ).current;

  const handleScoreSelect = async (score: number) => {
    const currentPhoto = photos[currentIndex];
    if (!currentPhoto || !currentUser) return;

    try {
      await createVote({
        room_id: roomId as string,
        photo_id: currentPhoto._id || currentPhoto.id || '',
        user_id: currentUser.userId,
        score,
      });

      // Animate card away
      const direction = score > 0 ? 1 : -1;
      Animated.timing(position, {
        toValue: { x: direction * SCREEN_WIDTH * 1.5, y: 0 },
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        // Move to next photo
        setCurrentIndex(currentIndex + 1);
        position.setValue({ x: 0, y: 0 });
        setShowScoreButtons(null);
        
        // Update voted photos
        setVotedPhotos(prev => new Set([...prev, currentPhoto._id || currentPhoto.id || '']));
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit vote');
      position.setValue({ x: 0, y: 0 });
      setShowScoreButtons(null);
    }
  };

  const handleUndo = async () => {
    try {
      const result = await undoVote(roomId as string, currentUser.userId);
      
      // Find the photo that was just unvoted
      const photoIndex = photos.findIndex(p => 
        (p._id || p.id) === result.photo_id
      );
      
      if (photoIndex >= 0) {
        setCurrentIndex(photoIndex);
        setVotedPhotos(prev => {
          const newSet = new Set(prev);
          newSet.delete(result.photo_id);
          return newSet;
        });
      }
      
      position.setValue({ x: 0, y: 0 });
      setShowScoreButtons(null);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to undo vote');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D946B2" />
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No photos to vote on</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Room</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentIndex >= photos.length) {
    return (
      <View style={styles.completeContainer}>
        <Text style={styles.completeEmoji}>✅</Text>
        <Text style={styles.completeTitle}>All Done!</Text>
        <Text style={styles.completeText}>
          You've voted on all {photos.length} photos
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push(`/rankings/${roomId}`)}
        >
          <Text style={styles.primaryButtonText}>View Rankings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Back to Room</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentPhoto = photos[currentIndex];
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const renderPlaceholderImage = () => (
    <View style={styles.placeholderImage}>
      <Text style={styles.placeholderText}>📸</Text>
      <Text style={styles.placeholderFilename}>{currentPhoto.filename}</Text>
      <Text style={styles.placeholderSource}>
        {currentPhoto.source_type === 'local' ? '💾 Local' : '☁️ Drive'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.progress}>
          {currentIndex + 1} / {photos.length}
        </Text>
        <TouchableOpacity onPress={handleUndo}>
          <Text style={styles.headerButton}>↺ Undo</Text>
        </TouchableOpacity>
      </View>

      {/* Card Stack */}
      <View style={styles.cardContainer}>
        {/* Next card (behind) */}
        {currentIndex + 1 < photos.length && (
          <View style={[styles.card, styles.nextCard]}>
            {renderPlaceholderImage()}
          </View>
        )}

        {/* Current card */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate },
              ],
            },
          ]}
        >
          {currentPhoto.source_type === 'drive' && currentPhoto.drive_thumbnail_url ? (
            <Image
              source={{ uri: currentPhoto.drive_thumbnail_url }}
              style={styles.photoImage}
            />
          ) : (
            renderPlaceholderImage()
          )}

          {/* Swipe indicators */}
          {swiping && (
            <>
              <Animated.View
                style={[
                  styles.likeLabel,
                  {
                    opacity: position.x.interpolate({
                      inputRange: [0, SWIPE_THRESHOLD],
                      outputRange: [0, 1],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              >
                <Text style={styles.likeLabelText}>❤️ LIKE</Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.nopeLabel,
                  {
                    opacity: position.x.interpolate({
                      inputRange: [-SWIPE_THRESHOLD, 0],
                      outputRange: [1, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              >
                <Text style={styles.nopeLabelText}>❌ NOPE</Text>
              </Animated.View>
            </>
          )}
        </Animated.View>
      </View>

      {/* Score Selection Buttons */}
      {showScoreButtons && (
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreTitle}>
            {showScoreButtons === 'right' ? 'How much? ❤️' : 'How much? 👎'}
          </Text>
          <View style={styles.scoreButtons}>
            {showScoreButtons === 'right' ? (
              <>
                <TouchableOpacity
                  style={[styles.scoreButton, styles.scoreButtonPositive]}
                  onPress={() => handleScoreSelect(1)}
                >
                  <Text style={styles.scoreButtonText}>+1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.scoreButton, styles.scoreButtonPositive]}
                  onPress={() => handleScoreSelect(2)}
                >
                  <Text style={styles.scoreButtonText}>+2</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.scoreButton, styles.scoreButtonPositive]}
                  onPress={() => handleScoreSelect(3)}
                >
                  <Text style={styles.scoreButtonText}>+3</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.scoreButton, styles.scoreButtonNegative]}
                  onPress={() => handleScoreSelect(-1)}
                >
                  <Text style={styles.scoreButtonText}>-1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.scoreButton, styles.scoreButtonNegative]}
                  onPress={() => handleScoreSelect(-2)}
                >
                  <Text style={styles.scoreButtonText}>-2</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.scoreButton, styles.scoreButtonNegative]}
                  onPress={() => handleScoreSelect(-3)}
                >
                  <Text style={styles.scoreButtonText}>-3</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              Animated.spring(position, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: false,
              }).start();
              setShowScoreButtons(null);
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Instructions */}
      {!swiping && !showScoreButtons && (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>← Swipe Left to Dislike | Swipe Right to Like →</Text>
        </View>
      )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F7',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F7',
    padding: 32,
  },
  completeEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  completeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#fff',
  },
  headerButton: {
    fontSize: 16,
    color: '#D946B2',
    fontWeight: '600',
  },
  progress: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: SCREEN_WIDTH - 64,
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    position: 'absolute',
  },
  nextCard: {
    opacity: 0.5,
    transform: [{ scale: 0.95 }],
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  placeholderText: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderFilename: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  placeholderSource: {
    fontSize: 14,
    color: '#666',
  },
  likeLabel: {
    position: 'absolute',
    top: 50,
    right: 40,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '15deg' }],
  },
  likeLabelText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  nopeLabel: {
    position: 'absolute',
    top: 50,
    left: 40,
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '-15deg' }],
  },
  nopeLabelText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  scoreContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  scoreTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#1f2937',
  },
  scoreButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  scoreButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  scoreButtonPositive: {
    backgroundColor: '#10B981',
  },
  scoreButtonNegative: {
    backgroundColor: '#EF4444',
  },
  scoreButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  instructions: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  primaryButton: {
    backgroundColor: '#D946B2',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 16,
  },
  secondaryButtonText: {
    color: '#D946B2',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#D946B2',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
