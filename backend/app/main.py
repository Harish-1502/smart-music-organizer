from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, engine
from fastapi.staticfiles import StaticFiles
from app.routes import (
    library, 
    tracks,
    artist, 
    album, 
    playlist, 
    playback, 
    ai_playlists,
    tags
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Music Organizer API")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Backend is running"}

app.mount("/static", StaticFiles(directory="data"), name="static")

app.include_router(library.router)
app.include_router(tracks.router)
app.include_router(artist.router)
app.include_router(album.router)
app.include_router(playlist.router)
app.include_router(playback.router)
app.include_router(ai_playlists.router)
app.include_router(tags.router)