# Export a stepwise explainer as a GIF or MP4

A ~100-line script that records any page with a stepwise `PlayerBar`, one
step at a time, for posts and social previews. See the
[recipe](../../docs/RECIPES.md#exporting-a-gif-or-video) for how it works and
its limits.

```bash
npm install
node record.mjs https://stepwise.thesphynx.net/player --dark --selector "main .rounded-xl"
```

For an MP4, also write the frames and encode them with ffmpeg:

```bash
node record.mjs http://localhost:3000/article --frames frames
ffmpeg -framerate 2 -i frames/%04d.png -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -pix_fmt yuv420p explainer.mp4
```

`PW_CHANNEL=msedge` (or `chrome`) uses an installed browser instead of
Playwright's bundled Chromium (`npx playwright install chromium`).
