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

"Nothing can be deleted" protects memories. Production holds none. Checked
again on 2026-11-08, the evening before the final: **27 things, 82 keepings,
0 perspectives**, 88 people across names that are plainly fixtures — `Alice`
26 times, `Bob` 15, plus `Player One`, `Player Two`, `No Script`,
`Fragment One`, `Fragment Two`, `Typist`.

Zero perspectives is the decisive number. Since 2026-10-15 a thing cannot
reach a shelf without one, so a shelf of 82 keepings and no perspectives is
a shelf of nothing anybody chose to keep. Reading the titles confirms it:
`bob was here for this 1792503394938`, `xss-perspective-...`,
`<script>window.xss-...`. These are the suite's own leavings.

The gate below said `things is 26` when it was written in October. It is 27
now — one more test run. If this document ever refuses to let you continue
over a number like that, check whether the ROWS are real before loosening
it; the count moving is expected, a real memory appearing is not.

Once the family has put a real thing in the village, this procedure is over.
Deleting then would be the thing the rule forbids.

## Why the gate uses things, keepings and perspectives

The gate in Step 1 is keyed to `things`, `keepings` and `perspectives`, because
those tables only change when somebody actually places something in the village.
That is precisely the event that ends this procedure's validity. The `people`
count and the number of distinct names drift with every ordinary visit, so they
are printed for the human to look at but are **not** stop conditions. Do not
loosen the gate numbers when a check fails; a failure means a real thing may
exist.

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

## Notes on the commands

- `flyctl ssh console -C '...'` is **not a shell**. It splits the string into
  arguments and runs the first word directly. Do not put `cd`, `&&`, pipes or
  redirects inside `-C`; `cd /app && ...` fails with `exec: "cd": executable file
  not found`. The default working directory is already `/app`, where
  `better-sqlite3` resolves. If a real shell is ever needed, use `sh -c "..."`.
- The machine auto-stops when idle (`auto_stop_machines`, with no machines kept
  running). Step 0 wakes it first.

## Steps

0. **Wake the machine and confirm it is running.** A stopped machine does not
   answer ssh, and the failure is not explained: `flyctl ssh console` prints
   only a `fly status` hint. That means the machine is stopped, not that this
   runbook is broken. Wake it with one HTTPS request, then confirm.

   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" https://comp4020-final-anpham-09.fly.dev/
   mise exec -- flyctl status -a comp4020-final-anpham-09
   ```

   Expect `200` and a machine in the `started` state. Only then continue. If it
   is still not reachable, stop and ask the owner.

1. **Confirm it is still test data.** Print the row counts and the name
   distribution. Stop if any gate check fails.

   ```bash
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 -C 'node -e "const D=require(\"better-sqlite3\");const db=new D(\"/data/app.db\",{readonly:true});const n=(t)=>db.prepare(\"SELECT COUNT(*) AS c FROM \"+t).get().c;console.log(JSON.stringify({things:n(\"things\"),keepings:n(\"keepings\"),perspectives:n(\"perspectives\"),people:n(\"people\"),distinctNames:db.prepare(\"SELECT COUNT(DISTINCT name) AS c FROM people\").get().c,names:db.prepare(\"SELECT name, COUNT(*) AS c FROM people GROUP BY name ORDER BY c DESC\").all()}))"'
   ```

   **Hard stop conditions. Stop, and do not continue, unless all of these hold:**
   - `things` is 27
   - `keepings` is 82
   - `perspectives` is 0

   If any of these differs, a real thing may have been placed. Stop and ask the
   owner.

   For context only, not stop conditions: `people` and `distinctNames` (and the
   `names` list) drift with every visit. Look at them, but a different number
   there does not by itself stop the run.

2. **Back up the live database as one file.** This writes a consistent snapshot,
   WAL contents included, to a temporary path on the machine. It does not modify
   `/data/app.db`. If it fails with "file already exists", a previous attempt
   left `/tmp/village-before-accounts.db`; remove it with
   `flyctl ssh console ... -C 'rm /tmp/village-before-accounts.db'` and retry.

   ```bash
   mkdir -p ~/backups/village
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 -C 'node -e "const D=require(\"better-sqlite3\");const db=new D(\"/data/app.db\");db.prepare(\"VACUUM INTO ?\").run(\"/tmp/village-before-accounts.db\");db.close();console.log(\"snapshot written\")"'
   mise exec -- flyctl ssh sftp get /tmp/village-before-accounts.db ~/backups/village/before-accounts-$(date +%Y%m%d-%H%M%S).db -a comp4020-final-anpham-09
   ls -la ~/backups/village/
   ```

   Verify the local copy before going further. Replace `<backup-file>` with the
   file `ls` just showed. Both checks need the `sqlite3` command-line tool; any
   SQLite client works too.

   ```bash
   sqlite3 <backup-file> 'PRAGMA integrity_check;'
   sqlite3 <backup-file> 'SELECT COUNT(*) FROM things; SELECT COUNT(*) FROM keepings; SELECT COUNT(*) FROM perspectives;'
   ```

   The integrity check must print `ok`. The counts must be 26, 82 and 0. If not,
   stop. Then remove the temporary copy on the machine:

   ```bash
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 -C 'rm /tmp/village-before-accounts.db'
   ```

   The backup lives in `~/backups/village/`, outside the repository. It must not
   be committed.

3. **Delete the database and its sidecars, then restart.** Run Step 1's count
   command again first. The `things`, `keepings` and `perspectives` values must
   equal the Step 1 values. If anything changed, stop and go back to Step 2.

   ```bash
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 -C 'rm -f /data/app.db /data/app.db-wal /data/app.db-shm'
   mise exec -- flyctl apps restart comp4020-final-anpham-09
   ```

   All three files are removed together. A stale `app.db-wal` left beside a new
   database could be replayed into it or rejected at boot. The restart follows
   immediately, so the running process, which still holds the old files open,
   is stopped before it can write further. The schema is recreated at boot.

4. **Confirm the village is empty and the keys load.** Wait until the app is
   healthy again, repeating Step 0 if it has auto-stopped. Then check the counts.
   Every count must be 0 and `names` must be `[]`.

   ```bash
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 -C 'node -e "const D=require(\"better-sqlite3\");const db=new D(\"/data/app.db\",{readonly:true});const n=(t)=>db.prepare(\"SELECT COUNT(*) AS c FROM \"+t).get().c;console.log(JSON.stringify({things:n(\"things\"),keepings:n(\"keepings\"),perspectives:n(\"perspectives\"),people:n(\"people\"),names:db.prepare(\"SELECT name, COUNT(*) AS c FROM people GROUP BY name ORDER BY c DESC\").all()}))"'
   ```

   Then search the whole recent log, not just its last lines. Warnings can appear
   after `listening`, so `tail` is not enough:

   ```bash
   mise exec -- flyctl logs -a comp4020-final-anpham-09 --no-tail | grep -E "listening|no code|not hashes"
   ```

   Expect a `listening` line from after the restart and **no** lines matching
   `these houses have no code` or `HOUSEHOLD_CODES has entries that are not
   hashes`. Either one means the codes did not load; stop and ask the owner
   before anyone uses the village.

## 5. Cut the household codes

**Do this before telling anyone the village is ready.** Until
`HOUSEHOLD_CODES` is set, every house is claimable by whoever reaches the
URL first — the app says so at boot rather than pretending otherwise, but
saying so is not preventing it.

One code per house, not per person: the two adults in a household share
theirs. Type each one in; never pass it as an argument.

```bash
read -rs "c?Nghe An's code: " && printf '%s' "$c" | pnpm -s household-code "nghe-an"; unset c
read -rs "c?Hanoi's code: "   && printf '%s' "$c" | pnpm -s household-code "hanoi";   unset c
read -rs "c?Canberra's code: " && printf '%s' "$c" | pnpm -s household-code "canberra"; unset c
```

Each prints one `"slug":"salt:hash"` fragment. Collect all three into one
JSON object and set it as a single secret. Setting it restarts the machine.

```bash
mise exec -- flyctl secrets set HOUSEHOLD_CODES='{"nghe-an":"...","hanoi":"...","canberra":"..."}' -a comp4020-final-anpham-09
```

Then confirm, with the same grep as Step 4: a `listening` line and **no**
warning about houses with no code. Finally, remove the secret the keys used
to live in, which nothing reads any more:

```bash
mise exec -- flyctl secrets unset MEMBER_KEYS -a comp4020-final-anpham-09
```

Give each household its own code out of band — not in this repository, not
in the app, and not over the group chat the app exists to replace.
