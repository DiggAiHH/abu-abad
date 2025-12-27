import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import { useParams } from 'react-router-dom';

export default function VideoCall() {
  const { roomId } = useParams();

  return (
    <Container sx={{ mt: 4 }}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Video Call
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Room ID: {roomId}
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mt: 2 }}>
          Video call interface coming soon...
        </Typography>
      </Box>
    </Container>
  );
}
