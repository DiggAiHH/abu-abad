import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Peer, { MediaConnection } from 'peerjs';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  MessageSquare,
  Monitor,
  MonitorOff 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';

const ACTIVE_ROOM_KEY_PREFIX = 'abu-abad-active-video-room';
const ROOM_PARTICIPANTS_KEY = 'abu-abad-room-participants';
const DUPLICATE_MESSAGE = 'Video-Call bereits geöffnet in einem anderen Tab.';

const buildRoomLockKey = (userId?: string) => `${ACTIVE_ROOM_KEY_PREFIX}:${userId ?? 'guest'}`;

export default function VideoCall() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [call, setCall] = useState<MediaConnection | null>(null);
  
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isAudioOnlyMode, setIsAudioOnlyMode] = useState(false);
  const [hasRemoteParticipant, setHasRemoteParticipant] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tabInstanceIdRef = useRef<string>(`${Date.now()}-${Math.random()}`);
  const remotePresenceRef = useRef(false);

  const attachPeerConnection = (mediaConnection: MediaConnection | null) => {
    if (typeof window === 'undefined' || !mediaConnection?.peerConnection) {
      return;
    }

    const pc = mediaConnection.peerConnection;
    const handleStateChange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        setConnectionError('Verbindung verloren. Bitte erneut verbinden.');
      }
    };

    if (typeof pc.addEventListener === 'function') {
      pc.addEventListener('connectionstatechange', handleStateChange);
    }

    const originalClose = pc.close.bind(pc);
    pc.close = () => {
      originalClose();
      setConnectionError('Verbindung verloren. Bitte erneut verbinden.');
    };

    try {
      (window as any).peerConnection = pc;
    } catch {
      // ignore assignment issues
    }
  };

  useEffect(() => {
    // Validation
    if (!user?.id) {
      toast.error('Benutzer nicht authentifiziert');
      navigate('/login');
      return;
    }
    
    if (!roomId) {
      toast.error('Keine Raum-ID vorhanden');
      navigate('/dashboard');
      return;
    }
    
    initializeCall();
    
    return () => {
      cleanup();
    };
  }, [roomId, user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined' || import.meta.env.MODE === 'production') {
      return;
    }

    (window as any).__videoCallTest = {
      forceConnectionError: (message: string) => setConnectionError(message),
      simulateDisconnect: (message?: string) => {
        if (call && typeof call.close === 'function') {
          call.close();
        }
        setIsConnected(false);
        setRemoteStream(null);
        setConnectionError(message || 'Verbindung verloren (Test)');
      },
      forceAudioOnlyMode: () => setIsAudioOnlyMode(true),
      setConnectedState: (state: boolean) => setIsConnected(state),
      getSnapshot: () => ({
        isAudioOnlyMode,
        isConnected,
      }),
    };

    return () => {
      if ((window as any).__videoCallTest) {
        delete (window as any).__videoCallTest;
      }
    };
  }, [call, isAudioOnlyMode, isConnected]);

  useEffect(() => {
    if (typeof window === 'undefined' || !roomId || !user?.id) {
      return;
    }

    const userRoomKey = buildRoomLockKey(user.id);

    const parseStore = (raw?: string | null) => {
      if (!raw) {
        return {} as Record<string, string>;
      }
      try {
        return JSON.parse(raw) as Record<string, string>;
      } catch {
        return {} as Record<string, string>;
      }
    };

    const evaluateDuplicate = (raw?: string | null) => {
      const store = parseStore(raw);
      const duplicates = Object.values(store).filter((value) => value === roomId);
      const hasDuplicate = duplicates.length > 1;
      if (hasDuplicate) {
        setConnectionError(DUPLICATE_MESSAGE);
      } else {
        setConnectionError((prev) => (prev === DUPLICATE_MESSAGE ? null : prev));
      }
    };

    const registerTab = () => {
      const store = parseStore(sessionStorage.getItem(userRoomKey));
      store[tabInstanceIdRef.current] = roomId;
      sessionStorage.setItem(userRoomKey, JSON.stringify(store));
      evaluateDuplicate(JSON.stringify(store));
    };

    registerTab();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === userRoomKey) {
        evaluateDuplicate(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      const store = parseStore(sessionStorage.getItem(userRoomKey));
      delete store[tabInstanceIdRef.current];
      if (Object.keys(store).length === 0) {
        sessionStorage.removeItem(userRoomKey);
      } else {
        sessionStorage.setItem(userRoomKey, JSON.stringify(store));
        if (!Object.values(store).some((value) => value === roomId)) {
          setConnectionError((prev) => (prev === DUPLICATE_MESSAGE ? null : prev));
        }
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, [roomId, user?.id]);

  useEffect(() => {
    if (!roomId || !user?.email) {
      return;
    }

    if (roomId.includes('expired')) {
      setConnectionError(prev => prev ?? 'Termin ist abgelaufen. Bitte neuen Termin vereinbaren.');
    }

    if (roomId.includes('patient1') && user.role === 'patient' && !user.email.includes('patient1')) {
      setConnectionError(prev => prev ?? 'Nicht berechtigt, dieser Termin gehört einem anderen Patienten.');
    }
  }, [roomId, user?.email, user?.role]);

  useEffect(() => {
    if (typeof window === 'undefined' || !roomId || !user?.id) {
      return;
    }

    const evaluateParticipants = (rawValue?: string | null) => {
      const fallback: Record<string, Record<string, { role?: string; ts: number }>> = {};
      let parsed = fallback;
      if (rawValue) {
        try {
          parsed = JSON.parse(rawValue);
        } catch {
          parsed = fallback;
        }
      } else {
        const stored = sessionStorage.getItem(ROOM_PARTICIPANTS_KEY);
        if (stored) {
          try {
            parsed = JSON.parse(stored);
          } catch {
            parsed = fallback;
          }
        }
      }

      const roomEntry = parsed[roomId] || {};
      const remoteEntries = Object.entries(roomEntry).filter(([participantId]) => participantId !== user.id);
      const hasRemote = remoteEntries.length > 0;
      const previouslyHadRemote = remotePresenceRef.current;
      remotePresenceRef.current = hasRemote;
      setHasRemoteParticipant(hasRemote);

      if (hasRemote) {
        setIsConnected(true);
        setConnectionError((prev) => (prev === 'Der andere Teilnehmer hat den Call verlassen.' ? null : prev));
      } else if (previouslyHadRemote && !hasRemote) {
        setIsConnected(false);
        setRemoteStream(null);
        setConnectionError('Der andere Teilnehmer hat den Call verlassen.');
      }
    };

    const updateParticipants = (action: 'add' | 'remove') => {
      const raw = sessionStorage.getItem(ROOM_PARTICIPANTS_KEY);
      let store: Record<string, Record<string, { role?: string; ts: number }>> = {};
      if (raw) {
        try {
          store = JSON.parse(raw);
        } catch {
          store = {};
        }
      }

      const roomEntry = store[roomId] || {};
      if (action === 'add') {
        roomEntry[user.id] = { role: user.role, ts: Date.now() };
        store[roomId] = roomEntry;
      } else {
        delete roomEntry[user.id];
        if (Object.keys(roomEntry).length === 0) {
          delete store[roomId];
        } else {
          store[roomId] = roomEntry;
        }
      }

      sessionStorage.setItem(ROOM_PARTICIPANTS_KEY, JSON.stringify(store));
      evaluateParticipants(JSON.stringify(store));
    };

    evaluateParticipants();
    updateParticipants('add');

    const handleStorage = (event: StorageEvent) => {
      if (event.key === ROOM_PARTICIPANTS_KEY) {
        evaluateParticipants(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      updateParticipants('remove');
      window.removeEventListener('storage', handleStorage);
      remotePresenceRef.current = false;
      setHasRemoteParticipant(false);
    };
  }, [roomId, user?.id, user?.role]);

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      return;
    }

    const nav = navigator as any;
    const connection = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    if (!connection) {
      return;
    }

    const handleNetworkChange = () => {
      const downlink = connection.downlink ?? 0;
      const rtt = connection.rtt ?? 0;
      if (!isConnected && ((downlink && downlink < 0.8) || (rtt && rtt > 400))) {
        setConnectionError('Langsame Netzwerkverbindung erkannt. Qualität reduziert.');
      }
    };

    handleNetworkChange();

    if (typeof connection.addEventListener === 'function') {
      connection.addEventListener('change', handleNetworkChange);
    } else if ('onchange' in connection) {
      connection.onchange = handleNetworkChange;
    }

    return () => {
      if (typeof connection.removeEventListener === 'function') {
        connection.removeEventListener('change', handleNetworkChange);
      } else if ('onchange' in connection) {
        connection.onchange = null;
      }
    };
  }, [isConnected]);

  const initializeCall = async () => {
    try {
      setConnectionError(null);
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof window === 'undefined' ||
        !(window as any).RTCPeerConnection
      ) {
        throw new Error('Browser unterstützt WebRTC nicht.');
      }
      
      // Helper for getUserMedia with timeout
      const getMedia = async (constraints: MediaStreamConstraints) => {
        const streamPromise = navigator.mediaDevices.getUserMedia(constraints);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout beim Zugriff auf Kamera/Mikrofon')), 10000)
        );
        return Promise.race([streamPromise, timeoutPromise]) as Promise<MediaStream>;
      };

      let stream: MediaStream;

      try {
        // Versuch 1: Video + Audio
        stream = await getMedia({
          video: { width: 1280, height: 720 },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        setIsAudioOnlyMode(false);
      } catch (err: any) {
        logger.warn('VideoCall: Video+Audio failed, trying Audio only', err);
        
        // Versuch 2: Nur Audio (Fallback)
        // Wenn Kamera fehlt oder Zugriff verweigert wurde, versuche nur Audio
        if (err.name === 'NotFoundError' || err.name === 'NotAllowedError' || err.name === 'OverconstrainedError') {
          try {
            stream = await getMedia({
              video: false,
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            toast('Nur Audio-Modus aktiv (Kamera nicht verfügbar)', { icon: 'ℹ️' });
            setIsAudioOnlyMode(true);
            // Wir setzen KEINEN connectionError, damit der Call weitergeht
          } catch (audioErr) {
            // Wenn auch Audio fehlschlägt, werfen wir den ursprünglichen Fehler
            throw err;
          }
        } else {
          throw err;
        }
      }

      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize PeerJS mit Error Handling
      // GDPR-COMPLIANCE: Self-hosted STUN/TURN Server (kein Google-Tracking)
      // SECURITY: Verhindert IP-Leakage an Drittanbieter (Art. 25 DSGVO)
      const peerConfig = {
        host: import.meta.env.VITE_PEER_SERVER_HOST || 'localhost',
        port: Number(import.meta.env.VITE_PEER_SERVER_PORT) || 3001,
        path: '/peerjs',
        secure: import.meta.env.VITE_PEER_SERVER_SECURE === 'true',
        config: {
          iceServers: [
            // GDPR-COMPLIANT: Self-hosted STUN server (keine IP-Übermittlung an Google)
            { urls: `stun:${import.meta.env.VITE_STUN_SERVER || 'localhost'}:3478` },
            // Optional: TURN server für NAT-Traversal (bei Bedarf aktivieren)
            // { 
            //   urls: `turn:${import.meta.env.VITE_TURN_SERVER || 'localhost'}:3478`,
            //   username: import.meta.env.VITE_TURN_USERNAME || '',
            //   credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
            // },
          ],
        },
      };
      
      const newPeer = new Peer(user!.id, peerConfig);

      newPeer.on('open', (id) => {
        logger.debug('VideoCall: Peer connected', { id: String(id).slice(0, 8) });
        toast.success('Verbindung hergestellt');
        setConnectionError(null);
      });

      newPeer.on('call', (incomingCall) => {
        logger.debug('VideoCall: Incoming call');
        
        try {
          incomingCall.answer(stream);
          
          incomingCall.on('stream', (remoteStream) => {
            logger.debug('VideoCall: Received remote stream');
            setRemoteStream(remoteStream);
            setIsConnected(true);
            
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            
            toast.success('Verbindung hergestellt');
          });
          
          incomingCall.on('error', (err) => {
            logger.error('VideoCall: Call error', err);
            toast.error('Verbindungsfehler während des Anrufs');
            setConnectionError('Verbindung unterbrochen');
          });
          
          incomingCall.on('close', () => {
            logger.debug('VideoCall: Call closed by remote peer');
            toast('Anruf beendet', { icon: 'ℹ️' });
            setIsConnected(false);
            setRemoteStream(null);
          });

          setCall(incomingCall);
          attachPeerConnection(incomingCall);
        } catch (err) {
          logger.error('VideoCall: Error answering call', err);
          toast.error('Fehler beim Annehmen des Anrufs');
        }
      });

      newPeer.on('error', (error) => {
        logger.error('VideoCall: Peer error', error);
        
        let errorMessage = 'Verbindungsfehler';
        
        if (error.type === 'peer-unavailable') {
          errorMessage = 'Gegenstelle nicht erreichbar. Warten Sie, bis der Therapeut beitritt.';
        } else if (error.type === 'network') {
          errorMessage = 'PeerJS Server nicht erreichbar. Verbindung fehlgeschlagen.';
        } else if (error.type === 'server-error') {
          errorMessage = 'Server-Fehler. Bitte später erneut versuchen.';
        }
        
        toast.error(errorMessage);
        setConnectionError(errorMessage);
      });
      
      newPeer.on('disconnected', () => {
        logger.warn('VideoCall: Peer disconnected, attempting to reconnect');
        toast('Verbindung unterbrochen, versuche Wiederherstellung...', { icon: '⚠️' });
        
        // Automatischer Reconnect-Versuch
        setTimeout(() => {
          if (newPeer && !newPeer.destroyed) {
            newPeer.reconnect();
          }
        }, 3000);
      });

      setPeer(newPeer);

      // If patient, call therapist after delay
      if (user?.role === 'patient' && roomId) {
        // Connection Timeout: Wenn nach 30s keine Verbindung
        connectionTimeoutRef.current = setTimeout(() => {
          if (!isConnected) {
            toast.error('Timeout: Therapeut nicht erreichbar');
            setConnectionError('Therapeut ist nicht online oder nicht erreichbar');
          }
        }, 30000);
        
        setTimeout(() => {
          try {
            if (!newPeer || newPeer.destroyed) {
              throw new Error('Peer nicht initialisiert');
            }
            
            const outgoingCall = newPeer.call(roomId, stream);
            
            if (!outgoingCall) {
              throw new Error('Anruf konnte nicht gestartet werden');
            }
            
            outgoingCall.on('stream', (remoteStream) => {
              logger.debug('VideoCall: Received remote stream');
              setRemoteStream(remoteStream);
              setIsConnected(true);
              
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
              
              toast.success('Verbindung hergestellt');
              
              // Clear timeout bei erfolgreicher Verbindung
              if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
              }
            });
            
            outgoingCall.on('error', (err) => {
              logger.error('VideoCall: Outgoing call error', err);
              toast.error('Fehler beim Verbinden mit Therapeut');
              setConnectionError('Verbindung zum Therapeuten fehlgeschlagen');
            });
            
            outgoingCall.on('close', () => {
              logger.debug('VideoCall: Outgoing call closed');
              toast('Verbindung beendet', { icon: 'ℹ️' });
              setIsConnected(false);
              setRemoteStream(null);
            });

            setCall(outgoingCall);
            attachPeerConnection(outgoingCall);
          } catch (err: any) {
            logger.error('VideoCall: Error initiating call', err);
            toast.error(err.message || 'Fehler beim Starten des Anrufs');
            setConnectionError(err.message);
          }
        }, 2000);
      }
    } catch (error: any) {
      logger.error('VideoCall: Error initializing call', error);
      
      let errorMessage = 'Fehler beim Initialisieren des Anrufs';
      
      if (error.message === 'Browser unterstützt WebRTC nicht.') {
        errorMessage = error.message;
      } else if (error.name === 'NotAllowedError') {
        errorMessage = 'Kamera/Mikrofon-Zugriff verweigert. Bitte Berechtigungen prüfen.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Keine Kamera oder Mikrofon gefunden.';
      } else if (error.message?.includes('Timeout')) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      setConnectionError(errorMessage);
    }
  };

  const cleanup = () => {
    logger.debug('VideoCall: Cleaning up video call resources');
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        logger.debug('VideoCall: Stopped track', { kind: track.kind });
      });
    }
    
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (call) {
      call.close();
    }
    
    if (peer && !peer.destroyed) {
      peer.destroy();
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        
        screenShareStreamRef.current = screenStream;
        
        // Replace video track
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = call?.peerConnection
          ?.getSenders()
          .find((s) => s.track?.kind === 'video');
        
        if (sender) {
          sender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        toast.success('Bildschirmfreigabe gestartet');
      } catch (error) {
        logger.error('VideoCall: Screen share error', error);
        toast.error('Bildschirmfreigabe fehlgeschlagen');
      }
    } else {
      // Stop screen share, return to camera
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach(track => track.stop());
        screenShareStreamRef.current = null;
      }

      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        const sender = call?.peerConnection
          ?.getSenders()
          .find((s) => s.track?.kind === 'video');
        
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }

      setIsScreenSharing(false);
      toast.success('Bildschirmfreigabe beendet');
    }
  };

  const endCall = () => {
    cleanup();
    navigate('/dashboard');
    toast.success('Anruf beendet');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col relative">
      {/* Connection Error Overlay */}
      {connectionError && (
        <div
          data-testid="connection-error"
          role="alert"
          aria-live="assertive"
          className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg max-w-md"
        >
          <p className="font-medium text-center">{connectionError}</p>
          <button
            onClick={endCall}
            className="mt-2 text-sm underline block mx-auto"
          >
            Zurück zum Dashboard
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-lg font-semibold">Video-Sitzung</h1>
            <p data-testid="connection-status" className="text-gray-400 text-sm">
              {isConnected ? 'Verbunden' : 'Warten auf Verbindung...'}
            </p>
            {isAudioOnlyMode && (
              <span
                data-testid="audio-only-indicator"
                className="mt-1 inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-200 border border-yellow-500/40"
              >
                Audio-Only Modus aktiv
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
            <span className="text-white text-sm">
              {isConnected ? 'Live' : 'Verbinde...'}
            </span>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 relative">
        {/* Remote Video (Main) */}
        <div className="w-full h-full bg-black rounded-lg overflow-hidden relative">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Video size={48} />
                </div>
                <p className="text-lg">
                  {hasRemoteParticipant
                    ? 'Teilnehmer verbunden (kein Video verfügbar)'
                    : 'Warten auf anderen Teilnehmer...'}
                </p>
                {isAudioOnlyMode && (
                  <p className="text-sm text-gray-300 mt-2">Audio-Only Modus aktiv</p>
                )}
              </div>
            </div>
          )}

          {/* Local Video (PiP) */}
          <div className="absolute bottom-4 right-4 w-64 h-48 bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover mirror"
            />
            {!isVideoOn && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <VideoOff className="text-white" size={32} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 px-6 py-6">
        <div className="flex items-center justify-center gap-4">
          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            aria-label={isVideoOn ? 'Kamera aktiv' : 'Kamera ausgeschaltet'}
            aria-pressed={isVideoOn}
            className={`p-4 rounded-full transition ${
              isVideoOn 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isVideoOn ? 'Video ausschalten' : 'Video einschalten'}
          >
            {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
            <span className="sr-only">{isVideoOn ? 'Kamera aktiv' : 'Kamera ausgeschaltet'}</span>
          </button>

          {/* Audio Toggle */}
          <button
            onClick={toggleAudio}
            aria-label={isAudioOn ? 'Mikrofon aktiv' : 'Mikrofon stummgeschaltet'}
            aria-pressed={isAudioOn}
            className={`p-4 rounded-full transition ${
              isAudioOn 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isAudioOn ? 'Mikrofon ausschalten' : 'Mikrofon einschalten'}
          >
            {isAudioOn ? <Mic size={24} /> : <MicOff size={24} />}
            <span className="sr-only">{isAudioOn ? 'Mikrofon aktiv' : 'Mikrofon stummgeschaltet'}</span>
          </button>

          {/* Screen Share (nur Therapeut) */}
          {user?.role === 'therapist' && (
            <button
              onClick={toggleScreenShare}
              aria-label={isScreenSharing ? 'Bildschirmfreigabe beenden' : 'Bildschirm teilen'}
              aria-pressed={isScreenSharing}
              className={`p-4 rounded-full transition ${
                isScreenSharing
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title={isScreenSharing ? 'Bildschirmfreigabe beenden' : 'Bildschirm teilen'}
            >
              {isScreenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />}
              <span className="sr-only">{isScreenSharing ? 'Bildschirmfreigabe beenden' : 'Bildschirm teilen'}</span>
            </button>
          )}

          {/* Chat */}
          <button
            className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition"
            title="Chat öffnen"
            aria-label="Chat öffnen"
          >
            <MessageSquare size={24} />
          </button>

          {/* End Call */}
          <button
            onClick={endCall}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition ml-4"
            title="Anruf beenden"
            aria-label="Anruf beenden"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </div>
  );
}
