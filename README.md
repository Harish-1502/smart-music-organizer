# Smart Music Organizer

A full-stack local music organizer and playlist app built with React, FastAPI, SQLite, and SQLAlchemy.

It allows users to scan a local music folder, browse tracks, view album art, edit metadata, create playlists, and prepare the foundation for AI-assisted playlist generation.

---

## Features

- Local music library scanning
- Track browsing with search, sorting, filtering, and pagination
- Metadata extraction from audio files
- Album art display
- Music playback through the frontend player
- Mini player with playback persistence
- Track metadata editing
- Playlist creation, renaming, and deletion
- Add tracks to playlists
- Playlist track reordering
- Duplicate playlist entries supported
- FastAPI backend API
- SQLite local database
- SQLAlchemy models and Alembic migrations
- React frontend with reusable hooks and components
- Pytest backend testing
- Playwright end-to-end testing
- Early AI playlist generation foundation

---

## Architecture Overview

### Library Input Layer
User provides a local folder containing supported music files such as MP3, FLAC, WAV, M4A, AAC, or OGG.

### Scan Layer
The backend scans the selected folder, detects supported audio files, extracts metadata, and stores track information in the database.

### Database Layer
SQLite stores track metadata, file paths, playlist records, playlist-track relationships, and playlist ordering.

### Backend API Layer
FastAPI exposes endpoints for scanning, browsing tracks, editing metadata, loading album art, managing playlists, and reordering playlist tracks.

### Frontend Layer
React displays the music library, filters, track table, player controls, playlist pages, and add-track modal.

### Playback Layer
The frontend player manages audio playback, mini player state, progress tracking, and restored playback state after refresh.

### Playlist Layer
Users can create playlists, rename playlists, delete playlists, add tracks, remove tracks, and reorder tracks.

### AI Playlist Layer
Prompt parsing, tag inference, rule-based scoring, and playlist generation logic provide the foundation for AI-assisted playlists.

---

## Design Decisions

- Local-first design keeps the user’s music library private and available without cloud services
- SQLite was chosen because it is lightweight, simple to ship, and ideal for a personal local app
- FastAPI was used to create a clean backend API with Python typing and easy testing support
- SQLAlchemy separates database models from route logic
- Alembic manages database migrations as the schema grows
- React was used to build a responsive frontend with reusable hooks and components
- Playlist tracks use separate playlist-track IDs so the same song can appear multiple times in one playlist
- Playlist ordering is stored explicitly to support reliable reordering
- Album art is served from the backend instead of being embedded directly into the frontend
- Playwright was added to test real user flows such as route loading and player persistence
- The AI playlist system starts with rule-based logic before moving toward smarter recommendations

---

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- CSS
- React Router
- Axios

### Backend
- Python
- FastAPI
- SQLAlchemy
- Alembic
- SQLite

### Audio / Metadata
- Local audio file scanning
- Metadata extraction
- Album art extraction

### Testing
- Pytest
- Playwright

---

## Setup

### Requirements

- Python 3.10+
- Node.js
- npm
- SQLite
- Git
- A local folder containing music files

---

### Backend Setup

1. Download the repository

```bash
git clone https://github.com/your-username/smart-music-organizer.git
cd smart-music-organizer/backend

### Backend Setup

1. Download the repository

```bash
git clone https://github.com/your-username/smart-music-organizer.git
cd smart-music-organizer/backend

2. Create and activate a virtual environment
python -m venv venv

On Windows:

venv\Scripts\activate

On macOS/Linux:

source venv/bin/activate

Install backend dependencies:

pip install -r requirements.txt

Run database migrations:

alembic upgrade head

Start the backend server:
uvicorn app.main:app --reload

The backend should run at:

http://127.0.0.1:8000

Frontend Setup

Open a new terminal and go to the frontend folder:

cd smart-music-organizer/frontend

Install frontend dependencies:

npm install

Start the frontend development server:

npm run dev

The frontend should run at:

http://localhost:5173
