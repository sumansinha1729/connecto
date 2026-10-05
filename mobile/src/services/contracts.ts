/**
 * Service contracts. Screens and stores only depend on these interfaces;
 * `http/` implements them against the backend.
 */
import type {
  ActiveCall,
  AuthTokens,
  CallRecord,
  CreateRoomInput,
  EarningsSummary,
  ListenerApplicationInput,
  ListenerProfile,
  Me,
  PayoutMethodInput,
  ProfileUpdate,
  ReportReason,
  Room,
  RoomMessage,
  RoomReaction,
  RoomRole,
  User,
  UserFilters,
  VoiceCredentials,
  Wallet,
} from '@/types';

export interface AuthService {
  /** Dev codes from our own server (local testing; not available in production) */
  requestOtp(phone: string): Promise<{ devOtp?: string }>;
  verifyOtp(phone: string, code: string): Promise<{ tokens: AuthTokens; user: Me; isNewUser: boolean }>;
  /** Real login: Firebase checked the SMS code; the server turns its ID token into our session */
  loginWithFirebase(idToken: string): Promise<{ tokens: AuthTokens; user: Me; isNewUser: boolean }>;
  logout(): Promise<void>;
}

export interface UserService {
  getMe(): Promise<Me>;
  updateProfile(update: ProfileUpdate): Promise<Me>;
  /** Signup choice: talk to listeners ("user") or become one ("listener") */
  setIntent(intent: 'user' | 'listener'): Promise<Me>;
  /** Uploads a recorded voice intro (local file/blob uri) */
  uploadVoiceIntro(uri: string, durationSec: number): Promise<Me>;
  /** Sends the listener application for admin review */
  submitListenerApplication(input: ListenerApplicationInput): Promise<Me>;
  deleteAccount(): Promise<void>;
  listUsers(filters: UserFilters): Promise<User[]>;
  /** Someone's profile plus whether you've favourited them */
  /** listenerProfile is set for listeners (voice intro, stats, rating breakdown). Your own id works too. */
  getProfile(userId: string): Promise<{ user: User; isFavorite: boolean; listenerProfile: ListenerProfile | null }>;
  listFavorites(): Promise<User[]>;
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
  acceptCall(callId: string): Promise<{ voice: VoiceCredentials | null }>;
  rejectCall(callId: string): Promise<void>;
  /** Hangs up an active call or cancels a ringing one */
  endCall(callId: string): Promise<void>;
  /** Your ringing/active call according to the server (to resync after a lost connection or app restart) */
  getActive(): Promise<ActiveCall | null>;
  rateCall(callId: string, stars: number): Promise<void>;
  /** Fresh voice credentials while the call is on (voice tokens are short-lived) */
  getVoice(callId: string): Promise<VoiceCredentials | null>;
  /** Newest first. Pass the oldest `startedAt` you have to load the page before it. */
  getHistory(before?: string): Promise<CallRecord[]>;
  /** Finds a random available listener to talk to */
  findMatch(language?: string | null): Promise<User>;
}

/** Listener-only: ₹ earnings and withdrawals */
export interface EarningsService {
  getSummary(): Promise<EarningsSummary>;
  setPayoutMethod(method: PayoutMethodInput): Promise<Me>;
  /** Withdraws the whole balance */
  withdraw(): Promise<void>;
}

export interface RoomService {
  listRooms(): Promise<Room[]>;
  createRoom(input: CreateRoomInput): Promise<Room>;
  /** Also returns the recent chat */
  joinRoom(roomId: string): Promise<{ room: Room; voice: VoiceCredentials | null; messages: RoomMessage[] }>;
  /** Host or co-host: change the title or the welcome message */
  updateRoom(roomId: string, input: { title?: string; description?: string }): Promise<void>;
  leaveRoom(roomId: string): Promise<void>;
  /** Fresh voice credentials for your current role (voice tokens are short-lived) */
  getVoice(roomId: string): Promise<VoiceCredentials | null>;
  setHandRaised(roomId: string, raised: boolean): Promise<void>;
  setMuted(roomId: string, muted: boolean): Promise<void>;
  /** Host or co-host (only the host can make co-hosts) */
  setRole(roomId: string, userId: string, role: Exclude<RoomRole, 'host'>): Promise<void>;
  /** Host or co-host: mute someone on stage */
  muteParticipant(roomId: string, userId: string): Promise<void>;
  /** Host or co-host */
  removeParticipant(roomId: string, userId: string): Promise<void>;
  sendMessage(roomId: string, text: string): Promise<RoomMessage>;
  /** Your own message, or anyone's for the host / co-hosts */
  deleteMessage(roomId: string, messageId: string): Promise<void>;
  react(roomId: string, emoji: RoomReaction): Promise<void>;
}

/** Live connection for server → client events */
export interface RealtimeConnection {
  connect(): void;
  disconnect(): void;
}

export interface Api {
  auth: AuthService;
  users: UserService;
  wallet: WalletService;
  earnings: EarningsService;
  calls: CallService;
  rooms: RoomService;
  connection: RealtimeConnection;
}
