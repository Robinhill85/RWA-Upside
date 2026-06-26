// Read committed snapshot JSON from data/snapshots at build/request time.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "data", "snapshots");

export async function listSnapshotDates() {
  try {
    const files = await readdir(DIR);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
  } catch {
    return [];
  }
}

export async function loadSnapshot(date) {
  return JSON.parse(await readFile(path.join(DIR, `${date}.json`), "utf8"));
}

export async function loadLatest() {
  const dates = await listSnapshotDates();
  if (!dates.length) return null;
  return loadSnapshot(dates[dates.length - 1]);
}

// snapshot from ~7 days before the latest, for week-over-week deltas
export async function loadWeekAgo() {
  const dates = await listSnapshotDates();
  if (dates.length < 2) return null;
  const latest = new Date(dates[dates.length - 1]);
  const target = new Date(latest);
  target.setDate(target.getDate() - 7);
  // closest snapshot on/before target
  const prior = dates.filter((d) => new Date(d) <= target);
  return prior.length ? loadSnapshot(prior[prior.length - 1]) : loadSnapshot(dates[0]);
}
