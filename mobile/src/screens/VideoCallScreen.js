import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Alert } from 'react-native';
import { Button, Title, Surface, Snackbar } from 'react-native-paper';
import { videoService } from '../services';

const { width, height } = Dimensions.get('window');

export default function VideoCallScreen({ route, navigation }) {
  const { appointmentId, doctorId, patientId } = route.params || {};
  const [roomId, setRoomId] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  useEffect(() => {
    initializeCall();
  }, []);

  const initializeCall = async () => {
    try {
      // Create video room with actual IDs from route params
      const response = await videoService.createRoom(
        appointmentId, 
        doctorId || 'pending', 
        patientId || 'pending'
      );
      setRoomId(response.roomId);
    } catch (error) {
      setError('Failed to create video room. Please try again.');
      setSnackbarVisible(true);
    }
  };

  const startCall = () => {
    if (!roomId) {
      setError('Video room not ready. Please wait.');
      setSnackbarVisible(true);
      return;
    }
    setIsCallActive(true);
    // Initialize WebRTC connection here
    // This would require native WebRTC implementation
  };

  const endCall = async () => {
    if (roomId) {
      try {
        await videoService.endCall(roomId);
        setIsCallActive(false);
        navigation.goBack();
      } catch (error) {
        setError('Failed to end call properly.');
        setSnackbarVisible(true);
        // Still navigate back even if API call fails
        setTimeout(() => navigation.goBack(), 1500);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.videoContainer}>
        <View style={styles.remoteVideo}>
          <Title style={styles.placeholder}>Remote Video Stream</Title>
        </View>
        
        <View style={styles.localVideo}>
          <Title style={styles.placeholderSmall}>Local Video</Title>
        </View>
      </Surface>

      <View style={styles.controls}>
        {!isCallActive ? (
          <Button 
            mode="contained" 
            icon="phone"
            onPress={startCall}
            style={styles.startButton}
            disabled={!roomId}
          >
            Start Call
          </Button>
        ) : (
          <>
            <Button 
              mode="contained" 
              icon="microphone-off"
              onPress={() => {}}
              style={styles.controlButton}
            >
              Mute
            </Button>
            <Button 
              mode="contained" 
              icon="video-off"
              onPress={() => {}}
              style={styles.controlButton}
            >
              Video Off
            </Button>
            <Button 
              mode="contained" 
              icon="phone-hangup"
              onPress={endCall}
              style={[styles.controlButton, styles.endButton]}
            >
              End Call
            </Button>
          </>
        )}
      </View>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {error}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    width: width,
    height: height - 150,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  localVideo: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 120,
    height: 160,
    backgroundColor: '#333',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#fff',
    fontSize: 20,
  },
  placeholderSmall: {
    color: '#fff',
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  startButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
  },
  controlButton: {
    marginHorizontal: 5,
  },
  endButton: {
    backgroundColor: '#F44336',
  },
});
