CREATE TABLE if not exists users (
    id SERIAL PRIMARY KEY,
    spotify_id VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE if not exists sessions(
    session_id SERIAL PRIMARY KEY,
    user_id INT,
    category_id INT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    song_count INT,
    artist_count INT
);
ALTER TABLE sessions
ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users (id);

CREATE TABLE if not exists vibes(
    vibe_id SERIAL PRIMARY KEY,
    vibe_name VARCHAR(50),
    emoji_index INT,
    session_id INT
);
ALTER TABLE vibes
ADD CONSTRAINT fk_session_id FOREIGN KEY (session_id) REFERENCES sessions (session_id);