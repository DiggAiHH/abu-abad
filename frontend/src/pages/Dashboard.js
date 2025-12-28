import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  AppBar,
  Toolbar,
  IconButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import EventIcon from '@mui/icons-material/Event';
import PeopleIcon from '@mui/icons-material/People';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import axios from 'axios';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    totalPatients: 0,
    upcomingCalls: 0,
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const appointmentsResponse = await axios.get(
        `http://localhost:5000/api/appointments?date=${today}`
      );
      const patientsResponse = await axios.get('http://localhost:5000/api/patients');
      
      setStats({
        todayAppointments: appointmentsResponse.data.appointments?.length || 0,
        totalPatients: patientsResponse.data.patients?.length || 0,
        upcomingCalls: appointmentsResponse.data.appointments?.filter(
          a => a.status === 'scheduled'
        ).length || 0,
      });
    } catch (error) {
      // Silently fail to avoid disrupting the dashboard load
      setStats({
        todayAppointments: 0,
        totalPatients: 0,
        upcomingCalls: 0,
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Abu Abad - Dashboard
          </Typography>
          <Button color="inherit" onClick={() => navigate('/patients')}>
            Patients
          </Button>
          <Button color="inherit" onClick={() => navigate('/appointments')}>
            Appointments
          </Button>
          <Button color="inherit" onClick={() => navigate('/calendar')}>
            Calendar
          </Button>
          <Button color="inherit" onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome, {user?.name || 'User'}!
        </Typography>
        <Typography variant="subtitle1" gutterBottom color="textSecondary">
          {user?.role === 'doctor' ? 'Neurologist Dashboard' : 'Patient Dashboard'}
        </Typography>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <EventIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                  <Box>
                    <Typography variant="h4">{stats.todayAppointments}</Typography>
                    <Typography color="textSecondary">Today's Appointments</Typography>
                  </Box>
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/appointments')}>
                  View All
                </Button>
              </CardActions>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon sx={{ fontSize: 40, color: 'secondary.main', mr: 2 }} />
                  <Box>
                    <Typography variant="h4">{stats.totalPatients}</Typography>
                    <Typography color="textSecondary">Total Patients</Typography>
                  </Box>
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/patients')}>
                  Manage
                </Button>
              </CardActions>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <VideoCallIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                  <Box>
                    <Typography variant="h4">{stats.upcomingCalls}</Typography>
                    <Typography color="textSecondary">Upcoming Calls</Typography>
                  </Box>
                </Box>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => navigate('/calendar')}>
                  Schedule
                </Button>
              </CardActions>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
