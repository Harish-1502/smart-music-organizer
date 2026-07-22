export default function PlayerNowPlayingCard({
  isPlaying,
  title,
  artist,
  album,
  displayFileName,
  artworkUrl,
  currentIndex,
  queueLength,
}) {
  return (
    <>
      <div
        className={`player-page__art${isPlaying ? " player-page__art--playing" : ""}`}
        aria-hidden="true"
      >
        {artworkUrl ? (
          <img className="player-page__art-image" src={artworkUrl} alt="" />
        ) : (
          <div className="player-page__art-disc"></div>
        )}
      </div>

      <div className="player-page__meta">
        <h1
          id="player-title"
          className="player-page__title"
          title={displayFileName}
        >
          {title}
        </h1>
        <p className="player-page__artist">{artist}</p>
        <p className="player-page__album" title={album}>
          {album}
        </p>
        <p className="player-page__queue-meta">
          Track {currentIndex + 1} of {queueLength}
        </p>
      </div>
    </>
  );
}
