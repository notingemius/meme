-- МемКарти — схема бази даних (PostgreSQL / Neon)
-- Запустити ОДИН раз перед першим запуском.
-- Приклад: psql "$DATABASE_URL" -f db/schema.sql

CREATE TABLE IF NOT EXISTS meme_cards (
  id         SERIAL PRIMARY KEY,
  image_url  TEXT NOT NULL,
  title      TEXT
);

CREATE TABLE IF NOT EXISTS situations (
  id       SERIAL PRIMARY KEY,
  text_ua  TEXT NOT NULL,
  text_ru  TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
  id                    SERIAL PRIMARY KEY,
  code                  TEXT NOT NULL UNIQUE,
  status                TEXT NOT NULL DEFAULT 'lobby', -- lobby | playing | judging | results | finished
  mode                  TEXT NOT NULL DEFAULT 'judge', -- judge | vote
  language              TEXT NOT NULL DEFAULT 'ua',    -- ua | ru
  target_score          INTEGER NOT NULL DEFAULT 5,
  current_round         INTEGER NOT NULL DEFAULT 0,
  current_situation_id  INTEGER REFERENCES situations(id),
  current_judge_id      INTEGER,
  host_player_id        INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id            SERIAL PRIMARY KEY,
  room_id       INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nickname      TEXT NOT NULL,
  score         INTEGER NOT NULL DEFAULT 0,
  avatar_color  TEXT NOT NULL DEFAULT '#2563EB',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_bot        BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_hands (
  id            SERIAL PRIMARY KEY,
  player_id     INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  meme_card_id  INTEGER NOT NULL REFERENCES meme_cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submissions (
  id            SERIAL PRIMARY KEY,
  room_id       INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number  INTEGER NOT NULL,
  player_id     INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  meme_card_id  INTEGER NOT NULL REFERENCES meme_cards(id) ON DELETE CASCADE,
  votes         INTEGER NOT NULL DEFAULT 0,
  is_winner     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS votes (
  id               SERIAL PRIMARY KEY,
  room_id          INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number     INTEGER NOT NULL,
  voter_player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  submission_id    INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE
);

-- Індекси для швидких запитів стану гри
CREATE INDEX IF NOT EXISTS idx_players_room       ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_hands_player        ON player_hands(player_id);
CREATE INDEX IF NOT EXISTS idx_subs_room_round     ON submissions(room_id, round_number);
CREATE INDEX IF NOT EXISTS idx_votes_room_round    ON votes(room_id, round_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vote_once      ON votes(room_id, round_number, voter_player_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_submit_once     ON submissions(room_id, round_number, player_id);
