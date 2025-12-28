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
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Validation
    if (!user?.id) {
      toast.error('Benutzer nicht authentifiziert');
      navigate('/dashboard');
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

  const initializeCall = async () => {
    try {
      setConnectionError(null);
      
      // Get user media mit Timeout
      const streamPromise = navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout beim Zugriff auf Kamera/Mikrofon')), 10000)
      );
      
      const stream = await Promise.race([streamPromise, timeoutPromise]);

      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize PeerJS mit Error Handling
      const peerConfig = {
        host: import.meta.env.VITE_PEER_SERVER_HOST || 'localhost',
        port: Number(import.meta.env.VITE_PEER_SERVER_PORT) || 3001,
        path: '/peerjs',
        secure: import.meta.env.VITE_PEER_SERVER_SECURE === 'true',
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      };
      
      const newPeer = new Peer(user!.id, peerConfig);

      newPeer.on('open', (id) => {
        console.log('Peer connected with ID:', id);
        toast.success('Verbindung hergestellt');
        setConnectionError(null);
      });

      newPeer.on('call', (incomingCall) => {
        console.log('Incoming call...');
        
        try {
          incomingCall.answer(stream);
          
          incomingCall.on('stream', (remoteStream) => {
            console.log('Received remote stream');
            setRemoteStream(remoteStream);
            setIsConnected(true);
            
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            
            toast.success('Verbindung hergestellt');
          });
          
          incomingCall.on('error', (err) => {
            console.error('Call error:', err);
            toast.error('Verbindungsfehler während des Anrufs');
            setConnectionError('Verbindung unterbrochen');
          });
          
          incomingCall.on('close', () => {
            console.log('Call closed by remote peer');
            toast('Anruf beendet', { icon: 'ℹ️' });
            setIsConnected(false);
            setRemoteStream(null);
          });

          setCall(incomingCall);
        } catch (err) {
          console.error('Error answering call:', err);
          toast.error('Fehler beim Annehmen des Anrufs');
        }
      });

      newPeer.on('error', (error) => {
        console.error('Peer error:', error);
        
        let errorMessage = 'Verbindungsfehler';
        
        if (error.type === 'peer-unavailable') {
          errorMessage = 'Gegenstelle nicht erreichbar. Warten Sie, bis der Therapeut beitritt.';
        } else if (error.type === 'network') {
          errorMessage = 'Netzwerkproblem. Bitte Verbindung prüfen.';
        } else if (error.type === 'server-error') {
          errorMessage = 'Server-Fehler. Bitte später erneut versuchen.';
        }
        
        toast.error(errorMessage);
        setConnectionError(errorMessage);
      });
      
      newPeer.on('disconnected', () => {
        console.log('Peer disconnected, attempting to reconnect...');
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
              console.log('Received remote stream');
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
              console.error('Outgoing call error:', err);
              toast.error('Fehler beim Verbinden mit Therapeut');
              setConnectionError('Verbindung zum Therapeuten fehlgeschlagen');
            });
            
            outgoingCall.on('close', () => {
              console.log('Outgoing call closed');
              toast('Verbindung beendet', { icon: 'ℹ️' });
              setIsConnected(false);
              setRemoteStream(null);
            });

            setCall(outgoingCall);
          } catch (err: any) {
            console.error('Error initiating call:', err);
            toast.error(err.message || 'Fehler beim Starten des Anrufs');
            setConnectionError(err.message);
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error initializing call:', error);
      
      let errorMessage = 'Fehler beim Initialisieren des Anrufs';
      
      if (error.name === 'NotAllowedError') {
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
    console.log('Cleaning up video call resources...');
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
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
        console.error('Screen share error:', error);
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
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg max-w-md">
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
            <p className="text-gray-400 text-sm">
              {isConnected ? 'Verbunden' : 'Warten auf Verbindung...'}
            </p>
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
                <p className="text-lg">Warten auf anderen Teilnehmer...</p>
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
            className={`p-4 rounded-full transition ${
              isVideoOn 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isVideoOn ? 'Video ausschalten' : 'Video einschalten'}
          >
            {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
          </button>

          {/* Audio Toggle */}
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition ${
              isAudioOn 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isAudioOn ? 'Mikrofon ausschalten' : 'Mikrofon einschalten'}
          >
            {isAudioOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>

          {/* Screen Share (nur Therapeut) */}
          {user?.role === 'therapist' && (
            <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-full transition ${
                isScreenSharing
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title={isScreenSharing ? 'Bildschirmfreigabe beenden' : 'Bildschirm teilen'}
            >
              {isScreenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />}
            </button>
          )}

          {/* Chat */}
          <button
            className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition"
            title="Chat öffnen"
          >
            <MessageSquare size={24} />
          </button>

          {/* End Call */}
          <button
            onClick={endCall}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition ml-4"
            title="Anruf beenden"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
