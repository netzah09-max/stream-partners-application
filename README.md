# Discord Live Bot

This app hosts a public creator application website, sends applications to Discord for review, and posts live notifications when accepted streamers go live.

The watchlist is stored in `data/watchlist.json`. Website applications are stored in `data/applications.json`. For a larger public server, this can later move to SQLite/Postgres without changing the Discord approval flow.

## What works now

- Hosts a public application chooser with streamer partner and staff forms.
- Sends streamer partner and staff applications to separate Discord review channels with Accept and Deny buttons.
- Adds accepted streamer partner channel links to the live notification watchlist automatically.
- Gives accepted streamer partner and staff applicants their configured roles when possible.
- DMs applicants when their application is accepted or denied, when their Discord account can be found.
- Avoids repeat spam by remembering the last stream ID it notified.
- Checks Twitch and Kick live status from just the accepted channel link.
- Checks YouTube live status when `YOUTUBE_API_KEY` is configured.
- Includes a TikTok live-status adapter hook for a third-party service.
- Includes a CLI to add, remove, disable, enable, and list streamers manually.

TikTok links can be accepted and stored now, but TikTok live notifications require a third-party live-status endpoint because TikTok does not offer an official public API for this.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Create a Discord app and bot in the Discord Developer Portal.

Use the Discord Bot Token in `.env`. Do not use the Application ID, Client ID, or Public Key for `DISCORD_BOT_TOKEN`.

The bot needs access to the notification channel and both application review channels with:

- View Channel
- Send Messages
- Embed Links
- Manage Roles, if you want accepted applicants to receive a role

You do not need the privileged Message Content intent for this bot.

If you set `DISCORD_ACCEPTED_ROLE_ID` or `DISCORD_STAFF_ACCEPTED_ROLE_ID`, put the bot's own role above those accepted roles in Discord's role list. Discord user IDs or mentions are the most reliable way for applicants to identify themselves, but the bot also tries to match typed usernames.

4. Optional for Twitch live alerts: create one Twitch application in the Twitch Developer Console and put its client ID and client secret into `.env`.

This is one Twitch app for your bot/server. You do not need a separate Twitch client ID for each streamer.

For the Twitch app's OAuth Redirect URL, `http://localhost` is fine for this bot because live checks use a server-to-server app token and do not send users through Twitch login. If you later add a real "Log in with Twitch" button, replace it with your real callback URL, such as `https://your-domain.com/auth/twitch/callback`.

5. Add Twitch channels to the watchlist manually, if you want:

```bash
npm run watch:add -- twitch twitchdev
npm run watch:add -- twitch anotherchannel
```

6. Start the bot:

```bash
npm start
```

The website starts in the same process. By default it listens on:

```bash
http://localhost:3000
```

On a public host like Render, Railway, or a VPS, set `PUBLIC_BASE_URL` to your real website URL and keep using `npm start`.

Preview the form without Discord credentials:

```bash
npm run preview:web
```

## Cloudflare Tunnel From Your PC

If your PC is running the bot and you do not want to buy a domain, run the bot first:

```powershell
cd C:\discord-live-bot
npm start
```

Then open another PowerShell window and run:

```powershell
cd C:\discord-live-bot
.\scripts\start-cloudflare-tunnel.ps1
```

Cloudflare will print a public `https://...trycloudflare.com` link. Share that link with applicants. Keep both windows open while the bot and website should stay online.

This no-domain Cloudflare link is temporary and can change when you restart the tunnel.

## Custom Domain

The root page lets applicants choose which form they want. The streamer partner form is served at `/apply/streampartner`, and the staff form is served at `/apply/staff`.

For example:

```text
https://streamsyndicate.online -> application chooser
https://streamsyndicate.online/apply/streampartner -> streamer partner form
https://streamsyndicate.online/apply/staff -> staff form
```

For a permanent Cloudflare domain, add `streamsyndicate.online` to Cloudflare, change the domain's nameservers at Namecheap to the two nameservers Cloudflare gives you, then create a named Cloudflare Tunnel with these public hostnames:

```text
streamsyndicate.online     -> http://localhost:3000
www.streamsyndicate.online -> http://localhost:3000
```

You can also add this if you want a direct subdomain:

```text
apply.streamsyndicate.online -> http://localhost:3000
```

## Streamer Partner Application Flow

1. A creator submits `/apply/streampartner`.
2. The bot posts their answers into `DISCORD_APPLICATIONS_CHANNEL_ID`.
3. Staff press Accept or Deny in Discord.
4. Accept saves the submitted channel link into `data/watchlist.json`.
5. Accept gives the applicant `DISCORD_ACCEPTED_ROLE_ID` when that setting is filled in and the typed Discord account can be found.
6. The bot DMs the applicant with an accepted or denied message when the typed Discord account can be found.
7. The live monitor reloads that watchlist every poll and posts future live alerts into `DISCORD_NOTIFICATION_CHANNEL_ID`.

## Staff Application Flow

1. A staff applicant submits `/apply/staff`.
2. The bot posts their answers into `DISCORD_STAFF_APPLICATIONS_CHANNEL_ID`.
3. Staff press Accept or Deny in Discord.
4. Accept gives the applicant `DISCORD_STAFF_ACCEPTED_ROLE_ID` when that setting is filled in and the typed Discord account can be found.
5. The bot DMs the applicant with an accepted or denied message when the typed Discord account can be found.

## Commands

Add a streamer:

```bash
npm run watch:add -- twitch twitchdev
```

Add a streamer and override the Discord destination channel for that streamer:

```bash
npm run watch:add -- twitch twitchdev --channel-id=123456789012345678
```

List streamers:

```bash
npm run watch:list
```

Remove a streamer:

```bash
npm run watch:remove -- twitch twitchdev
```

Disable without deleting:

```bash
npm run watch:disable -- twitch twitchdev
```

Enable again:

```bash
npm run watch:enable -- twitch twitchdev
```

Check Twitch credentials and current live state without starting Discord:

```bash
npm run check:twitch
```

Check YouTube credentials and current live state without starting Discord:

```bash
npm run check:youtube
```

Check whether the bot can access both Discord channels from `.env`:

```bash
npm run check:discord
```

## YouTube Live Notifications

YouTube live checks need one Google Cloud API key for the bot. You do not need a separate key for every streamer.

1. Open Google Cloud Console.
2. Create or select a project.
3. Enable **YouTube Data API v3** for that project.
4. Go to **APIs & Services** -> **Credentials**.
5. Create an **API key**.
6. Restrict the key to **YouTube Data API v3**.
7. Paste the key into `.env`:

```env
YOUTUBE_API_KEY=your_google_api_key_here
```

8. Restart the bot with `npm start`.
9. Run `npm run check:youtube` to confirm the key works.

YouTube creators can apply with links like `https://youtube.com/@channelname` or `https://www.youtube.com/channel/UC...`. When accepted, their channel is added to the watchlist and checked every poll.

## Environment Variables

| Name | Required | Purpose |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | Yes | Discord bot token. |
| `DISCORD_NOTIFICATION_CHANNEL_ID` | Yes | Default Discord channel for live notifications. |
| `DISCORD_APPLICATIONS_CHANNEL_ID` | Yes for streamer form | Discord channel where streamer partner applications should be sent. |
| `DISCORD_ACCEPTED_ROLE_ID` | No | Role ID to give a streamer partner applicant when staff press Accept. |
| `DISCORD_STAFF_APPLICATIONS_CHANNEL_ID` | Yes for staff form | Discord channel where staff applications should be sent. |
| `DISCORD_STAFF_ACCEPTED_ROLE_ID` | No | Role ID to give a staff applicant when staff press Accept. |
| `TWITCH_PING_ROLE_ID` | No | Twitch ping ID. |
| `KICK_PING_ROLE_ID` | No | Kick ping ID. |
| `YOUTUBE_PING_ROLE_ID` | No | YouTube ping ID. |
| `TIKTOK_PING_ROLE_ID` | No | TikTok ping ID. |
| `DISCORD_LIVE_ROLE_IDS` | No | Optional backup role IDs for platforms without a platform ping ID. |
| `TWITCH_CLIENT_ID` | For Twitch | Twitch app client ID. One app handles all watched Twitch streamers. |
| `TWITCH_CLIENT_SECRET` | For Twitch | Twitch app client secret. |
| `YOUTUBE_API_KEY` | For YouTube | YouTube Data API v3 key used to check accepted YouTube channels. |
| `TIKTOK_LIVE_CHECK_URL` | For TikTok | Third-party endpoint used to check accepted TikTok channels. |
| `TIKTOK_LIVE_CHECK_API_KEY` | No | Optional bearer token for the TikTok live-check endpoint. |
| `TWITCH_CHANNELS` | No | Comma-separated Twitch handles to seed on startup. |
| `POLL_INTERVAL_SECONDS` | No | Polling interval. Defaults to `60`. |
| `DATA_DIR` | No | Data folder. Defaults to `./data`. |
| `PORT` | No | Website port. Defaults to `3000`. |
| `HOST` | No | Website listen host. Defaults to `0.0.0.0`. |
| `PUBLIC_BASE_URL` | No | Public website URL shown in logs. |
| `MESSAGE_TEMPLATE` | No | Discord message text. Supports `{displayName}`, `{handle}`, `{platform}`, `{platformName}`, `{title}`, and `{url}`. |

For platform ping roles, put them in `.env` like this:

```env
TWITCH_PING_ROLE_ID=111111111111111111
KICK_PING_ROLE_ID=222222222222222222
YOUTUBE_PING_ROLE_ID=333333333333333333
TIKTOK_PING_ROLE_ID=444444444444444444
```

The old `DISCORD_LIVE_ROLE_ID` and `DISCORD_LIVE_ROLE_IDS` settings still work as a backup.
