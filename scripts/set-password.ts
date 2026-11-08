// Sets the password on an account that already exists. The password arrives
// on stdin:
//
//   read -rs "p?New password for An: " && printf '%s' "$p" | pnpm -s set-password "An"; unset p
//
// The password is never an argument, for the same three reasons as
// household-code.ts: `ps` shows every argument on the machine to every other
// process, pnpm echoes the command it runs, and the shell writes it to
// history. zsh's `read -rs` keeps it off the screen on the way in too.
//
// THIS IS NOT ACCOUNT RECOVERY, and there is deliberately no route to it.
// The app collects no email, so there is nobody to prove a reset request
// came from. This is a hand tool for whoever already holds the database —
// the only person who could have edited the column by hand anyway. Having
// it as a script means that operation is salted, hashed and length-checked
// instead of a hand-rolled UPDATE with a paste in it.
//
// Only the password changes. The household stays, and nothing the account
// placed moves: identity is the NAME, so every memory, perspective and
// keeping still points at the same person afterwards.
//
// It writes to whichever database DATABASE_PATH names, defaulting to the
// same local file the dev server uses. To change a password in production,
// run it there — never against a copy, which would be overwritten by the
// next deploy.

const name = process.argv[2];

const usage = [
  'usage: read -rs "p?New password for <name>: " && printf \'%s\' "$p" | pnpm -s set-password "<name>"; unset p',
  "",
  "The password is typed in, not passed as an argument, so that it stays",
  "out of `ps`, the terminal and your shell history.",
].join("\n");

if (!name) {
  console.error(usage);
  process.exit(1);
}

// Waiting on a terminal would look like the script working while it silently
// did nothing, so say what to do instead of hanging.
if (process.stdin.isTTY) {
  console.error(`no password on stdin — nothing was changed.\n\n${usage}`);
  process.exit(1);
}

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
// Only the trailing newline goes. A password may contain spaces, and
// trimming would store something other than what was typed — the exact bug
// that makes a password work on one machine and fail on another.
const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");

// Imported after the argument checks so that a usage error does not open the
// database, and because importing it is what opens the connection.
const { setPassword } = await import("../src/accounts.ts");

const refusal = setPassword(name, password);

// Every refusal reaches the person as a sentence. A tool that fails with a
// code is a tool that gets run again with the same mistake.
const WHY: Record<string, string> = {
  "blank-password": "the password was empty, so nothing was changed.",
  "password-too-short": "that password is too short — eight characters or more.",
  "no-such-account": `there is no account called "${name}", so nothing was changed.`,
};

if (refusal) {
  console.error(WHY[refusal] ?? refusal);
  process.exit(1);
}

// Says what changed and what did not, because the thing people fear about a
// password tool is that it quietly took something else with it.
console.log(`Password set for ${name}.`);
console.log("Their household, memories and shelf are untouched.");
