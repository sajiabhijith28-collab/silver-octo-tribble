# AIWave Digital Solutions — Backend

This project serves the existing AIWave HTML website and adds a Node.js/Express backend for the contact form.

## Features
- `POST /api/contact` validates and stores contact enquiries in `data/enquiries.json`.
- Optional SMTP email notifications (configure `.env`).
- `GET /api/health` health-check endpoint.
- Basic security headers, JSON request-size limit, and API rate limiting.
- The original website is in `public/index.html` and the contact form has been connected to the API.

## Requirements
Install Node.js 20 or newer: https://nodejs.org/

## Run locally
```bash
npm install
cp .env.example .env
npm start
```
Open http://localhost:3000. Health check: http://localhost:3000/api/health

Email notifications are optional. Replace the example SMTP values in `.env` with credentials from your email provider. Never commit `.env` or share SMTP passwords.

## Enquiry storage
New enquiries are written to `data/enquiries.json`. Back up this file and restrict server filesystem access. For a larger production deployment, use a managed database instead of a local JSON file, especially if the hosting platform has an ephemeral filesystem or runs multiple instances.

## Deploy
Deploy to a Node.js host that supports persistent storage (or replace JSON storage with a database). Set environment variables in the host dashboard, then deploy. If the frontend is hosted on a separate domain, set `CORS_ORIGIN` to that exact domain.
