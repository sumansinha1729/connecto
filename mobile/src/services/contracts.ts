/**
 * Service contracts. Screens and stores only depend on these interfaces,
 * so the mock implementation can be swapped for the real HTTP/Socket.IO
 * backend without touching UI code.
 */
import type {
  CallRecord,
  CreateRoomInput,
  Me,
  ProfileUpdate,
  ReportReason,
  Room,
  RoomRole,
  User,
  UserFilters,
  Wallet,
} from '@/types';

export interface AuthService {
  requestOtp(phone: string): Promise<{ devOtp?: string }>;
  verifyOtp(phone: string, code: string): Promise<{ token: string; user: Me; isNewUser: boolean }>;
  logout(): Promise<void>;
}

export interface UserService {
  getMe(): Promise<Me>;
  updateProfile(update: ProfileUpdate): Promise<Me>;
  deleteAccount(): Promise<void>;
  listUsers(filters: UserFilters): Promise<User[]>;
  getUser(userId: string): Promise<User>;
  listFavorites(): Promise<User[]>;
  isFavorite(userId: string): Promise<boolean>;
  setFavorite(userId: string, favorite: boolean): Promise<void>;
  listBlocked(): Promise<User[]>;
  setBlocked(userId: string, blocked: boolean): Promise<void>;
  report(userId: string, reason: ReportReason, details: string): Promise<void>;
}

export interface WalletService {
  getWallet(): Promise<Wallet>;
  recharge(packId: string): Promise<Wallet>;
}

export interface CallService {
  /** Starts ringing the other user. Progress arrives via realtime `call:*` events. */
  startCall(userId: string): Promise<{ callId: string }>;
  acceptCall(callId: string): Promise<void>;
  rejectCall(callId: string): Promise<void>;
  /** Hangs up an active call or cancels a ringing one */
  endCall(callId: string): Promise<void>;
  rateCall(callId: string, stars: number): Promise<void>;
  getHistory(): Promise<CallRecord[]>;
  /** Finds a random available listener to talk to */
  findMatch(language?: string | null): Promise<User>;
  /** Development helper: makes a random online user call you */
  simulateIncomingCall(): Promise<void>;
}

export interface RoomService {
  listRooms(): Promise<Room[]>;
  createRoom(input: CreateRoomInput): Promise<Room>;
  joinRoom(roomId: string): Promise<Room>;
  leaveRoom(roomId: string): Promise<void>;
  setHandRaised(roomId: string, raised: boolean): Promise<void>;
  setMuted(roomId: string, muted: boolean): Promise<void>;
  /** Host only */
  setRole(roomId: string, userId: string, role: Exclude<RoomRole, 'host'>): Promise<void>;
  /** Host only */
  removeParticipant(roomId: string, userId: string): Promise<void>;
}

export interface Api {
  auth: AuthService;
  users: UserService;
  wallet: WalletService;
  calls: CallService;
  rooms: RoomService;
}
