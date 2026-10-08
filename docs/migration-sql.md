Database credentials are stored in `.env.development` / `.env.production`.
Plain SQL files are stored in the `migration/*.sql` directory.
File naming convention: `[four-digit serial number]_[table_name_in_plural]`. Example: `0001_authors.sql`.
The serial number sets the run order for the files.
Changing table fields (adding, removing) is done by adding new SQL files. Old files are never edited.
A separate service table, `schema_migration`, is created to track migrations, with fields `filename PK` and `migration_date`.
Migrations are run using the `./runner.js` script.

Runner:
- finds all files in `migration/*.sql`
- builds an array of them
- fetches the data from `schema_migration`
- filters the array down to files that are missing from `schema_migration`
- runs the not-yet-applied files, one after another, in order
- updates `schema_migration`