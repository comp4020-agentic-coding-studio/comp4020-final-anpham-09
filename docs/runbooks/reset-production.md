# Resetting the production village

> **HUMAN-ONLY PROCEDURE.** A person runs this by hand, deliberately, with the
> repo owner present. It is never to be executed by an agent, a script, CI, or
> any other automation, and no part of it may be run unattended.
>
> What it destroys: the production database `/data/app.db` on the
> `comp4020-final-anpham-09` volume, together with its write-ahead log
> `/data/app.db-wal` and shared-memory file `/data/app.db-shm`. Every person,
> thing, keeping and perspective in the village is removed. The only copy that
> survives is the backup taken in Step 2.

Run this once, when accounts first deploy, and never casually afterwards.

## Why this is allowed

"Nothing can be deleted" protects memories. At the time of writing production
held none: 78 people across 19 names, of which 26 were `Alice` and 15 `Bob`,
the rest fixtures (`Player One`, `DEPLOY CHECK A`, `No Script`). There were 82
keepings and **0 perspectives** — they predate the rule requiring one — and 33
keepings already had the same name on both sides of the shelf rule.

Once the family has put a real thing in the village, this procedure is over.
Deleting then would be the thing the rule forbids.

## Why three files, not one

The app runs SQLite in WAL mode (`journal_mode = WAL`, set in `src/db.ts`). New
writes land in `app.db-wal` first and are only merged into `app.db` at a later
checkpoint. At the time of writing the WAL was about 4 MB against a 100 KB main
file, so **`app.db` alone holds a small fraction of the data.** Copying it, or
deleting it, misses most of the database. `app.db-shm` is an index over the WAL.
Any one of the three without the others is either incomplete or invalid.

For that reason the backup is taken with `VACUUM INTO`, which writes a single,
self-contained, consistent copy that includes WAL contents, and the delete
removes all three files.

## Steps

1. **Confirm it is still test data.** Print the row counts and the name
   distribution, then compare with the baseline above. Stop if any check fails.

   ```bash
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 -C 'cd /app && node -e "const D=require(\"better-sqlite3\");const db=new D(\"/data/app.db\",{readonly:true});const n=(t)=>db.prepare(\"SELECT COUNT(*) AS c FROM \"+t).get().c;console.log(JSON.stringify({people:n(\"people\"),things:n(\"things\"),keepings:n(\"keepings\"),perspectives:n(\"perspectives\"),distinctNames:db.prepare(\"SELECT COUNT(DISTINCT name) AS c FROM people\").get().c,names:db.prepare(\"SELECT name, COUNT(*) AS c FROM people GROUP BY name ORDER BY c DESC\").all()}))"'
   ```

   **Stop, and do not continue, unless all of these hold:**
   - `people` is 78
   - `distinctNames` is 19
   - the `names` list has `Alice` with 26 and `Bob` with 15
   - `keepings` is 82
   - `perspectives` is 0

   If any value differs, a real person or real thing may have been added. Stop
   and ask the owner. `things` is printed for the record; its baseline was not
   recorded at the time of writing, so the owner records it here before running:
   `things = ____`.

2. **Back up the live database as one file.** This writes a consistent snapshot,
   WAL contents included, to a temporary path on the machine. It does not modify
   `/data/app.db`. If it fails with "file already exists", a previous attempt
   left `/tmp/village-before-accounts.db`; remove it with
   `flyctl ssh console ... -C 'rm /tmp/village-before-accounts.db'` and retry.

   ```bash
   mkdir -p ~/backups/village
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 -C 'cd /app && node -e "const D=require(\"better-sqlite3\");const db=new D(\"/data/app.db\");db.prepare(\"VACUUM INTO ?\").run(\"/tmp/village-before-accounts.db\");db.close();console.log(\"snapshot written\")"'
   mise exec -- flyctl ssh sftp get /tmp/village-before-accounts.db ~/backups/village/before-accounts-$(date +%Y%m%d-%H%M%S).db -a comp4020-final-anpham-09
   ls -la ~/backups/village/
   ```

   Verify the local copy before going further. Replace `<backup-file>` with the
   file `ls` just showed. Both checks need the `sqlite3` command-line tool; any
   SQLite client works too.

   ```bash
   sqlite3 <backup-file> 'PRAGMA integrity_check;'
   sqlite3 <backup-file> 'SELECT COUNT(*) FROM people; SELECT COUNT(*) FROM keepings; SELECT COUNT(*) FROM perspectives;'
   ```

   The integrity check must print `ok`. The counts must be 78, 82 and 0. If not,
   stop. Then remove the temporary copy on the machine:

   ```bash
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 -C 'rm /tmp/village-before-accounts.db'
   ```

   The backup lives in `~/backups/village/`, outside the repository. It must not
   be committed.

3. **Delete the database and its sidecars, then restart.** Run Step 1's count
   command again first. Its numbers must equal the Step 1 values. If anything
   changed, stop and go back to Step 2.

   ```bash
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 -C 'rm -f /data/app.db /data/app.db-wal /data/app.db-shm'
   mise exec -- flyctl apps restart comp4020-final-anpham-09
   ```

   All three files are removed together. A stale `app.db-wal` left beside a new
   database could be replayed into it or rejected at boot. The restart follows
   immediately, so the running process, which still holds the old files open,
   is stopped before it can write further. The schema is recreated at boot.

4. **Confirm the village is empty and the keys load.** Wait until the app is
   healthy again. Then run the count command from Step 1. Every count must be 0
   and `names` must be `[]`.

   ```bash
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 -C 'cd /app && node -e "const D=require(\"better-sqlite3\");const db=new D(\"/data/app.db\",{readonly:true});const n=(t)=>db.prepare(\"SELECT COUNT(*) AS c FROM \"+t).get().c;console.log(JSON.stringify({people:n(\"people\"),things:n(\"things\"),keepings:n(\"keepings\"),perspectives:n(\"perspectives\"),names:db.prepare(\"SELECT name, COUNT(*) AS c FROM people GROUP BY name ORDER BY c DESC\").all()}))"'
   ```

   Then search the whole recent log, not just its last lines. Warnings can appear
   after `listening`, so `tail` is not enough:

   ```bash
   mise exec -- flyctl logs -a comp4020-final-anpham-09 --no-tail | grep -E "listening|no keys cut|MEMBER_KEYS has entries that are not hashes"
   ```

   Expect a `listening` line from after the restart and **no** lines matching
   `no keys cut` or `MEMBER_KEYS has entries that are not hashes`. Any such line
   means the keys did not load; stop and ask the owner before anyone uses the
   village.
