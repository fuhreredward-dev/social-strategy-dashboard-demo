# Social Strategy Insight Software (Prototype)

Fictional post-performance analytics prototype for a sports media network.

## Stack
- Backend: FastAPI (Python)
- Frontend: HTML/CSS/JS
- Charts: Chart.js
- Data: Local JSON storage with seeded sample posts

## Project Structure
- app/main.py — API app and routes
- app/models.py — Pydantic data models
- app/services.py — Aggregations and metric utilities
- app/storage.py — JSON repository
- app/sample_data.py — Fictional seed dataset
- static/index.html — UI layout with tabs
- static/styles.css — Panel-style dashboard styling
- static/app.js — Frontend data loading + charts + interactions
- docs/index.html — GitHub Pages entrypoint (static demo mode)
- docs/mock/*.json — Mock API payloads for GitHub Pages
- data/posts.json — Data store

## Implemented Routes
- POST /add_post
- POST /bulk_upload
- GET /dashboard_summary
- GET /top_content
- GET /content/{post_id}
- GET /platform_summary
- GET /property_summary

## Features Included
- War-room dashboard layout with top-row summary cards
- Property/platform ranking columns and KPI + funnel box
- Top content gallery with sparkline charts
- Click-through content detail page with large multi-series curve
- Single post data entry form
- Bulk CSV/XLSX upload with preview and error list
- Period dropdown (This week, Last week, This month, Last month)

## Run Locally
1. Open terminal in workspace root.
2. Install dependencies:
   pip install -r requirements.txt
3. Start server:
   uvicorn app.main:app --reload
4. Open:
   http://127.0.0.1:8000

## Notes
- Data is fictional/sample for prototyping.
- On first run, sample records are auto-seeded into data/posts.json.
- You can add records from the Data Entry tab and see dashboard updates immediately.

## GitHub Pages Deployment (Showcase Mode)
This project includes a static showcase build in `docs/` so you can demo without running Python.

1. Create a GitHub repo and add remote:
   git init
   git add .
   git commit -m "Initial prototype"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main

2. In GitHub repo settings:
   - Go to **Settings → Pages**
   - Under **Build and deployment**, choose **Deploy from a branch**
   - Select **Branch: main** and **Folder: /docs**
   - Save

3. Your live URL will be:
   https://<your-username>.github.io/<your-repo>/

Notes for Pages mode:
- The UI auto-detects `github.io` and uses `docs/mock/*.json`.
- Data-entry write actions are disabled in Pages mode (read-only demo).
