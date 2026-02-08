import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL + '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// User APIs
export const createUser = async (username: string) => {
  const response = await api.post('/users', { username });
  return response.data;
};

export const getUser = async (userId: string) => {
  const response = await api.get(`/users/${userId}`);
  return response.data;
};

// Room APIs
export const createRoom = async (userId: string) => {
  const response = await api.post('/rooms', null, {
    params: { user_id: userId },
  });
  return response.data;
};

export const joinRoom = async (code: string, userId: string, username: string) => {
  const response = await api.post('/rooms/join', { code, user_id: userId, username });
  return response.data;
};

export const getRoom = async (roomId: string) => {
  const response = await api.get(`/rooms/${roomId}`);
  return response.data;
};

export const getRoomParticipants = async (roomId: string) => {
  const response = await api.get(`/rooms/${roomId}/participants`);
  return response.data;
};

// Photo APIs
export const importPhotos = async (data: {
  room_id: string;
  source_type: 'local' | 'drive';
  folder_path?: string;
  drive_folder_id?: string;
  drive_access_token?: string;
}) => {
  const response = await api.post('/photos/import', data);
  return response.data;
};

export const getRoomPhotos = async (roomId: string, skip = 0, limit = 50) => {
  const response = await api.get(`/photos/room/${roomId}`, {
    params: { skip, limit },
  });
  return response.data;
};

export const getPhoto = async (photoId: string) => {
  const response = await api.get(`/photos/${photoId}`);
  return response.data;
};

// Vote APIs
export const createVote = async (data: {
  room_id: string;
  photo_id: string;
  user_id: string;
  score: number;
}) => {
  const response = await api.post('/votes', data);
  return response.data;
};

export const undoVote = async (roomId: string, userId: string) => {
  const response = await api.post('/votes/undo', { room_id: roomId, user_id: userId });
  return response.data;
};

export const getUserVotes = async (roomId: string, userId: string) => {
  const response = await api.get(`/votes/room/${roomId}/user/${userId}`);
  return response.data;
};

// Ranking APIs
export const getRankings = async (roomId: string) => {
  const response = await api.get(`/rankings/${roomId}`);
  return response.data;
};

// Export APIs
export const exportPhotos = async (data: {
  room_id: string;
  top_n: number;
  destination_type: 'local' | 'drive';
  destination_path?: string;
  drive_folder_id?: string;
  drive_access_token?: string;
}) => {
  const response = await api.post('/export', data);
  return response.data;
};

// Storage helpers
export const saveCurrentUser = async (userId: string, username: string) => {
  await AsyncStorage.setItem('current_user', JSON.stringify({ userId, username }));
};

export const getCurrentUser = async () => {
  const data = await AsyncStorage.getItem('current_user');
  return data ? JSON.parse(data) : null;
};

export const saveCurrentRoom = async (roomId: string, code: string) => {
  await AsyncStorage.setItem('current_room', JSON.stringify({ roomId, code }));
};

export const getCurrentRoom = async () => {
  const data = await AsyncStorage.getItem('current_room');
  return data ? JSON.parse(data) : null;
};

export const clearStorage = async () => {
  await AsyncStorage.removeItem('current_user');
  await AsyncStorage.removeItem('current_room');
};
