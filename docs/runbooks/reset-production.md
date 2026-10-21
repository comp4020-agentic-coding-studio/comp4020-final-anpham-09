# Resetting the production village

Run this once, when accounts first deploy, and never casually afterwards.

## Why this is allowed

"Nothing can be deleted" protects memories. At the time of writing production
held none: 78 people across 19 names, of which 26 were `Alice` and 15 `Bob`,
the rest fixtures (`Player One`, `DEPLOY CHECK A`, `No Script`). There were 82
keepings and **0 perspectives** — they predate the rule requiring one — and 33
keepings already had the same name on both sides of the shelf rule.

Once the family has put a real thing in the village, this procedure is over.
Deleting then would be the thing the rule forbids.

## Steps

1. Confirm it is still test data. If this prints anything you recognise as a
   real memory, stop.

   ```bash
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 \
     -C 'node -e "const D=require(\"better-sqlite3\");const db=new D(\"/data/app.db\",{readonly:true});console.log(JSON.stringify(db.prepare(\"SELECT name, COUNT(*) n FROM people GROUP BY name ORDER BY n DESC\").all()))"'
   ```

2. Copy the file off the volume first. It is the only copy.

   ```bash
   mise exec -- flyctl ssh sftp get /data/app.db ./app.db.before-accounts -a comp4020-final-anpham-09
   ls -la app.db.before-accounts
   ```

   Keep it outside the repo. It is gitignored nowhere, and it must not be
   committed.

3. Remove the database and restart. The schema is recreated at boot.

   ```bash
   mise exec -- flyctl ssh console -a comp4020-final-anpham-09 -C 'rm /data/app.db'
   mise exec -- flyctl apps restart comp4020-final-anpham-09
   ```

4. Confirm the village is empty and the keys still load.

   ```bash
   mise exec -- flyctl logs -a comp4020-final-anpham-09 --no-tail | tail -3
   ```

   Expect `listening` and **no** warnings: no `no keys cut`, no
   `MEMBER_KEYS has entries that are not hashes`.
