import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createUser, getCurrentUser, saveCurrentUser, createRoom, joinRoom, saveCurrentRoom } from '../services/api';

export default function Index() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showUsernameInput, setShowUsernameInput] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const user = await getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setUsername(user.username);
    }
  };

  const handleSwitchUser = () => {
    setShowUsernameInput(true);
    setUsername(''); // Clear the username field
  };

  const handleSetUsername = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    try {
      setLoading(true);
      const user = await createUser(username.trim());
      await saveCurrentUser(user._id || user.id, user.username);
      setCurrentUser({ userId: user._id || user.id, username: user.username });
      setShowUsernameInput(false);
      Alert.alert('Success', `Welcome, ${user.username}!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!currentUser) {
      setShowUsernameInput(true);
      return;
    }

    try {
      setLoading(true);
      const room = await createRoom(currentUser.userId);
      await saveCurrentRoom(room.room_id, room.code);
      router.push(`/room/${room.room_id}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!currentUser) {
      setShowUsernameInput(true);
      return;
    }

    if (!roomCode.trim()) {
      Alert.alert('Error', 'Please enter a room code');
      return;
    }

    try {
      setLoading(true);
      const result = await joinRoom(roomCode.trim(), currentUser.userId, currentUser.username);
      await saveCurrentRoom(result.room_id, roomCode.trim());
      router.push(`/room/${result.room_id}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  if (showUsernameInput && !currentUser) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.logo}>💍 VowSelect</Text>
          <Text style={styles.subtitle}>Set Your Username</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="words"
            placeholderTextColor="#999"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSetUsername}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => setShowUsernameInput(false)}
          >
            <Text style={styles.linkText}>Back</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>💍 VowSelect</Text>
        <Text style={styles.subtitle}>Wedding Photo Selection</Text>

        {currentUser && (
          <View style={styles.userInfo}>
            <Text style={styles.userText}>👤 {currentUser.username}</Text>
            <TouchableOpacity onPress={() => setShowUsernameInput(true)}>
              <Text style={styles.switchText}>Switch User</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleCreateRoom}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Create Selection Room</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Enter 5-digit room code"
          value={roomCode}
          onChangeText={setRoomCode}
          keyboardType="number-pad"
          maxLength={5}
          placeholderTextColor="#999"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleJoinRoom}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Join Selection Room</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F7',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 56,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#D946B2',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginBottom: 48,
  },
  userInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  userText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  switchText: {
    fontSize: 14,
    color: '#D946B2',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#1f2937',
  },
  button: {
    backgroundColor: '#EC4899',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#D946B2',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: '#D946B2',
    fontSize: 14,
    fontWeight: '600',
  },
});
