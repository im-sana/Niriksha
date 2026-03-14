# 🎓 AI-Proctor: AI-Powered Hybrid Exam Cheating Detection System

<p align="center">
  <img src="https://img.shields.io/badge/React-18-blue?logo=react" />
  <img src="https://img.shields.io/badge/FastAPI-0.110-green?logo=fastapi" />
  <img src="https://img.shields.io/badge/YOLOv8-Ultralytics-purple" />
  <img src="https://img.shields.io/badge/MediaPipe-0.10-orange" />
  <img src="https://img.shields.io/badge/MongoDB-Motor-brightgreen?logo=mongodb" />
  <img src="https://img.shields.io/badge/WebSocket-Real--time-cyan" />
</p>

> A full-stack, hackathon-grade exam proctoring platform combining **browser monitoring**, **computer vision AI**, and **real-time dashboards** to detect cheating in both online and offline exam environments.

---

## ✨ Features

| Module | Technology | Description |
|--------|-----------|-------------|
| Face Detection | MediaPipe Face Detection | Ensures student face is visible |
| Eye Gaze | MediaPipe Face Mesh (468 pts) | Detects look left/right/down |
| Head Pose | OpenCV solvePnP | 6-DoF head orientation estimation |
| Multiple Faces | YOLOv8 (COCO person class) | Detects impersonators |
| Phone Detection | YOLOv8 (COCO class 67) | Detects mobile phones |
| Hand Movement | MediaPipe Hands | Flags suspicious hand gestures |
| Talking Detection | MAR from Face Mesh | Detects mouth opening pattern |
| Browser Monitor | JavaScript Visibility API | Tab switch, fullscreen, keyboard block |

### 📊 Cheating Score System

| Event | Score |
|-------|-------|
| Look Left / Right | +2 |
| Look Down | +3 |
| Face Missing | +5 |
| Phone Detected | +10 |
| Multiple Faces | +10 |
| Tab Switch | +10 |
| **Flag Threshold** | **≥ 15** |

---

## 🗂️ Project Structure

```
Niriksha/
├── frontend/                   # React + Vite + Tailwind CSS
│   └── src/
│       ├── pages/
│       │   ├── LandingPage.jsx      # Animated hero + features
│       │   ├── ExamPage.jsx         # Webcam + MCQ + timer
│       │   ├── DashboardPage.jsx    # Teacher monitoring dashboard
│       │   └── AdminPage.jsx        # Exam & student management
│       ├── components/
│       │   └── Sidebar.jsx
│       └── hooks/
│           ├── useBrowserMonitor.js  # Tab/keyboard/fullscreen detection
│           └── useWebSocket.js       # Real-time WS client
│
├── backend/                    # Python FastAPI
│   ├── app.py                       # Main API + WebSocket server
│   ├── requirements.txt
│   ├── detection_modules/
│   │   ├── face_detection.py        # MediaPipe Face Detection
│   │   ├── face_mesh.py             # MediaPipe Face Mesh (468 landmarks)
│   │   ├── eye_movement.py          # Gaze: left/right/down
│   │   ├── head_pose.py             # OpenCV solvePnP
│   │   ├── multi_face.py            # YOLOv8 multiple persons
│   │   ├── phone_detection.py       # YOLOv8 phone (class 67)
│   │   ├── hand_detection.py        # MediaPipe Hands
│   │   ├── talking_detection.py     # Mouth Aspect Ratio
│   │   └── cheating_score.py        # Rule-based scoring engine
│   └── database/
│       ├── connection.py            # Motor async client + in-memory fallback
│       └── schemas.py               # Document dataclass schemas
│
└── models/                     # YOLOv8 model (auto-downloaded)
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18  
- **Python** ≥ 3.10  
- **MongoDB** (optional — system falls back to in-memory store if unavailable)

---

### 1. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

### 2. Backend

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Run FastAPI server
uvicorn app:app --reload --port 8000
# → http://localhost:8000
# → Swagger UI: http://localhost:8000/docs
```

> **Note:** YOLOv8 model (`yolov8n.pt`) will be **auto-downloaded** (~6 MB) on first startup.

---

### 3. MongoDB (Optional)

```bash
# Using Docker
docker run -d --name mongodb -p 27017:27017 mongo:7

# Or install MongoDB Community Edition locally
# https://www.mongodb.com/try/download/community
```

If MongoDB is not running, the backend automatically uses an **in-memory store** — perfect for demos.

---

## 🔌 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/start_exam` | Start exam session |
| POST | `/submit_exam` | Submit answers |
| POST | `/analyze_frame` | Analyze webcam frame (base64) |
| GET | `/student_report?student_id=&exam_id=` | Student session report |
| GET | `/cheating_logs?session_id=&limit=50` | Cheating event logs |
| GET | `/dashboard_stats` | Aggregated dashboard stats |
| WS | `/ws/exam/{session_id}` | Real-time WebSocket stream |

**Swagger UI:** http://localhost:8000/docs

---

## 🎨 UI Pages

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Animated hero, features, tech badges |
| Exam Interface | `/exam` | Webcam + MCQ + integrity monitor |
| Teacher Dashboard | `/dashboard` | Charts, student table, live alerts |
| Admin Panel | `/admin` | Exam/student management, settings |

---

## 🛡️ Browser Security

The exam interface enforces:
- ✅ Fullscreen mode (auto-re-enters on exit)
- ✅ Blocks: `Ctrl+T`, `Ctrl+W`, `Alt+Tab`, `F12`, `Ctrl+Shift+I`
- ✅ Detects tab switching via `visibilitychange`
- ✅ Detects window focus loss (`blur` event)
- ✅ Heuristic multi-monitor detection
- ✅ Right-click disabled

---

## 🏆 Built For

Hackathons · AI Demos · Academic Projects · Startup MVPs

**Stack:** React 18 · Vite · Tailwind CSS · Framer Motion · FastAPI · OpenCV · MediaPipe · YOLOv8 · Motor · MongoDB · WebSockets
