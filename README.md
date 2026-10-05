# RA7 Discord Bot

## Render
Create a Web Service and set:
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variable: `DISCORD_TOKEN=YOUR_BOT_TOKEN`

The HTTP server listens on `0.0.0.0:$PORT` for Render.

## Commands
- `!took @user text`
  - Deletes the command message.
  - Sends the text in the same channel.
  - User mentions remain real mentions.
- `!مسح 10`
- `!مسح 20`
- `!مسح 30`
- `!مسح 40`
- `!مسح 50`
- `!ticket`
  - Staff only.
  - Posts the ticket panel.

## Ticket buttons
- 🚨 بلاغ على لاعب
- ⚔️ تقديم على كلان
- 🎥 تقديم على صناع المحتوى
- 👮 بلاغ على إداري

The bot creates a `Tickets` category automatically if one does not exist.

## AFK
The bot automatically joins voice channel:
`1556742017537679462`

It attempts automatic voice recovery when disconnected.

## Discord Developer Portal
Enable:
- Message Content Intent

Recommended permissions:
- View Channels
- Send Messages
- Manage Messages
- Manage Channels
- Read Message History
- Connect
- Speak
