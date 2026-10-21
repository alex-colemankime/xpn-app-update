// The whole dependency tree's advisories, development tools included (CI's
// other audit covers only what ships). Fails on any high or critical one
// not listed, with its reason, in audit-exceptions.json; a listed one past
// its review date is reported, so the exception gets looked at again.
//
//   node tools/audit.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const exceptions = JSON.parse(readFileSync(new URL("../audit-exceptions.json", import.meta.url)));
let report;
try {
  report = execFileSync("npm", ["audit", "--json"], { encoding: "utf8" });
} catch (error) {
  // npm audit exits non-zero when it finds anything; its report is still the output.
  report = error.stdout;
}
const { vulnerabilities = {} } = JSON.parse(report);

// The advisories behind each high or critical entry (an entry can be there
// only because something it depends on is).
const advisories = new Map();
for (const [name, entry] of Object.entries(vulnerabilities)) {
  if (!["high", "critical"].includes(entry.severity)) continue;
  for (const via of entry.via) {
    if (typeof via === "string") continue;
    const id = via.url?.split("/").pop();
    if (id) advisories.set(id, { name, title: via.title, url: via.url });
  }
}

let failed = false;
for (const [id, { name, title, url }] of advisories) {
  const known = exceptions[id];
  if (!known) {
    failed = true;
    console.log(
      `::error::${name}: ${title} (${url}). Update it, or list it in audit-exceptions.json with why it doesn't apply.`,
    );
  } else {
    console.log(`Known: ${name} ${id}: ${known.why}`);
    const due = /^\d{4}-\d{2}-\d{2}/.exec(known.review || "")?.[0];
    if (due && due < new Date().toISOString().slice(0, 10)) {
      console.log(`::warning::The exception for ${id} (${name}) was due for review on ${due}.`);
    }
  }
}
for (const id of Object.keys(exceptions)) {
  if (!advisories.has(id))
    console.log(`::notice::${id} is no longer reported: remove its exception.`);
}
if (!failed) console.log(`Full dependency audit: ${advisories.size} known, none new.`);
process.exit(failed ? 1 : 0);
