export interface User {
  id?: string;
  _id?: string;
  username: string;
  created_at?: string;
}

export interface Room {
  id?: string;
  _id?: string;
  code: string;
  creator_id: string;
  created_at?: string;
  status: string;
}

export interface RoomParticipant {
  id?: string;
  _id?: string;
  room_id: string;
  user_id: string;
  username: string;
  joined_at?: string;
}

export interface Photo {
  id?: string;
  _id?: string;
  room_id: string;
  source_type: 'local' | 'drive';
  path?: string;
  drive_id?: string;
  drive_thumbnail_url?: string;
  filename: string;
  index: number;
  created_at?: string;
}

export interface Vote {
  id?: string;
  _id?: string;
  room_id: string;
  photo_id: string;
  user_id: string;
  score: number;
  timestamp?: string;
}

export interface PhotoRanking {
  photo_id: string;
  filename: string;
  source_type: 'local' | 'drive';
  path?: string;
  drive_id?: string;
  drive_thumbnail_url?: string;
  weighted_score: number;
  vote_count: number;
  rank: number;
}
