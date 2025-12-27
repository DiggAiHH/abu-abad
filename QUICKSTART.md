# Quick Start Guide

Get Abu Abad up and running in 5 minutes!

## Option 1: Docker (Fastest)

```bash
# Clone and start
git clone https://github.com/DiggAiHH/abu-abad.git
cd abu-abad
docker compose up -d

# Access the apps
# Backend: http://localhost:5000
# Frontend: http://localhost:3000
```

## Option 2: Local Development

### Backend
```bash
cd backend
npm install
cp .env.example .env
npm start
# Running at http://localhost:5000
```

### Frontend (new terminal)
```bash
cd frontend
npm install
npm start
# Running at http://localhost:3000
```

### Mobile (new terminal)
```bash
cd mobile
npm install
npm start
# Opens Expo DevTools
```

## First Steps

1. **Open Frontend**: Navigate to http://localhost:3000
2. **Login Screen**: You'll see the Abu Abad login page
3. **Register**: Use the API or create a user via backend
4. **Explore**: Check out the dashboard, patients, appointments, and calendar

## Create Your First User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com",
    "password": "password123",
    "name": "Dr. John Doe",
    "role": "doctor"
  }'
```

Then login with:
- Email: `doctor@example.com`
- Password: `password123`

## Test the API

```bash
./test-api.sh
```

This will run comprehensive tests on all API endpoints.

## Need Help?

- 📚 [Full Setup Guide](./SETUP.md)
- 📖 [API Documentation](./API_DOCS.md)
- 📝 [README](./README.md)

## What's Included?

✅ Patient Management  
✅ Doctor Profiles  
✅ Appointment Scheduling  
✅ Calendar with Time Slots  
✅ Video Call Infrastructure  
✅ Mobile App (React Native)  
✅ Web Portal (React)  
✅ REST API (Node.js/Express)  
✅ Docker Support  

## Key Features

- **Authentication**: JWT-based secure authentication
- **Real-time**: Socket.IO for video call signaling
- **Responsive**: Works on mobile, tablet, and desktop
- **Modern**: Built with latest technologies
- **Scalable**: Ready for production deployment

## Next Steps

1. ✅ Get it running (you're here!)
2. 🎨 Customize the styling
3. 💾 Add a database
4. 📹 Complete WebRTC implementation
5. 🚀 Deploy to production

Enjoy using Abu Abad! 🎉
