# Project Overview

Smart Music Organizer is a local-first music library app designed for users who manage their own music files.

The app scans local folders, extracts and stores track metadata, allows users to manage playlists, and supports tag-based organization. It also includes early AI playlist logic based on metadata such as title, artist, album, filename, folder path, manual tags, rule-based tags, BPM, energy, loudness, and duration.

The project is also being extended toward mobile support using Capacitor. The goal is for a mobile device to connect to the desktop backend over LAN, download tracks and metadata, and play music offline.

## Main Goals

- Build a useful local-first music organizer
- Practice full-stack software development
- Design a maintainable backend API
- Store and query track metadata with SQLite
- Add testing around important safety behavior
- Support LAN/mobile usage safely
- Build toward offline mobile playback