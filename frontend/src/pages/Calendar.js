import React from 'react';
import { Container, Typography, Box } from '@mui/material';

export default function Calendar() {
  return (
    <Container sx={{ mt: 4 }}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Calendar
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Calendar and scheduling interface coming soon...
        </Typography>
      </Box>
    </Container>
  );
}
