# CAD/PAD Egress Monitor

GitHub working copy of the live CAD/PAD Egress Monitor.

## Live source

- Site: https://cadpad-egress-monitor.papaa.chatgpt.site
- Repository: https://github.com/papa4568/CAD

## Repository layout

- `site/` — mirrored runnable snapshot of the live site and its same-origin assets.
- `tools/mirror-site.sh` — repeatable live-site mirror script.
- `.github/workflows/sync-live-site.yml` — GitHub Actions workflow that refreshes the snapshot from the live site.

## Run the mirrored site locally

From the repository root:

```bash
cd site
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Updating the baseline

Run the **Sync live CAD-PAD site** workflow in GitHub Actions, or run:

```bash
bash tools/mirror-site.sh
```

The mirror is intended to preserve the current live implementation as a stable starting point for further GitHub-based development.
