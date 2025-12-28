import React from 'react';
import { Container, Typography, Box } from '@mui/material';

export default function Appointments() {
  return (
    <Container sx={{ mt: 4 }}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Appointments
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Appointments management interface coming soon...
        </Typography>
      </Box>
    </Container>
  );
}
