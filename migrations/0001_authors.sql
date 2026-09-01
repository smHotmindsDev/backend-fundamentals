CREATE TABLE authors (
    author_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name text NOT NULL,
    last_name text NOT NULL
)