import React from 'react';
import { Container, Typography, Box } from '@mui/material';

export default function Patients() {
  return (
    <Container sx={{ mt: 4 }}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Patients Management
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Patient management interface coming soon...
        </Typography>
      </Box>
    </Container>
  );
}
