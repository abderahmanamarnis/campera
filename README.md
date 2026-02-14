# Campera

Simple check-in page that automatically captures a photo every 15 seconds and uploads it to the server.

## Requirements

- Node.js 18+ (you already have Node 22)

## Install

```powershell
npm install
```

## Run

```powershell
npm start
```

Then open:

```
http://localhost:3000
```

The browser will ask for camera permission. Allow it, and the app will take a photo immediately, then every 15 seconds.

## Notes

- Photos are saved on the server in the project folder as `photo_*.png`.
- Check-ins are stored locally in your browser (`localStorage`).
