# tamper-monkey-scripts

Personal [Tampermonkey](https://www.tampermonkey.net/) userscripts for day-to-day work.

## Layout

```
scripts/
  <site>/            # one folder per website the scripts run on
    <name>.user.js   # one userscript per file
```

## Scripts

| Script | Runs on | What it does |
| --- | --- | --- |
| [`scripts/github/pr-approve-lgtm.user.js`](scripts/github/pr-approve-lgtm.user.js) | GitHub pull requests | Adds a green **✔ /approve + /lgtm** button (bottom-right). One click fills the "Add a comment" box with `/approve` and `/lgtm` on two lines and posts it. |

## Installing a script

1. Install the Tampermonkey extension in your browser.
2. Open the script's **Raw** view on GitHub, e.g.
   <https://raw.githubusercontent.com/wadidaww/tamper-monkey-scripts/main/scripts/github/pr-approve-lgtm.user.js>.
   Tampermonkey detects the `.user.js` file and shows an **Install** page.
3. Click **Install**. Tampermonkey checks the same URL for updates, so bumping `@version` in a script is enough to roll out changes.

Alternatively, create a new script in the Tampermonkey dashboard and paste the file's contents.

## Adding a new script

1. Create `scripts/<site>/<name>.user.js` with a `==UserScript==` header.
2. Point `@updateURL` and `@downloadURL` at the file's raw URL on `main`.
3. Add a row to the table above.
