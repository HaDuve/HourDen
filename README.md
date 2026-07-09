# HourDen

Your den for billable hours — track time, review the month, send the invoice.

HourDen is a personal web app for freelancers who bill by the hour. Log work as you go, keep clients and projects organized, and turn tracked time into PDF invoices — without juggling separate tools.

**Live app:** [hourden.hannesduve.com](https://hourden.hannesduve.com)

Sign in with your account to get started.

## What you can do

| Area | What it's for |
|------|---------------|
| **Tracker** | Start and stop timers, or log time manually |
| **Clients** | People and companies you bill |
| **Projects** | Work streams under each client |
| **Report** | Review hours for a date range; export a spreadsheet if needed |
| **Invoices** | Preview, issue, and download invoice PDFs |
| **Import** | Bring in past time from Clockify |

## How it fits together

1. Set up your **invoice sender** details (your name, address, bank info — what appears on PDFs).
2. Add **clients** and **projects**.
3. **Track** time day to day.
4. At month end, check the **report**, then **issue invoices** for each client.

Issued invoices lock the covered time entries so they are not billed twice.

## Status

The core app is in daily use: time tracking, clients, projects, reports, Clockify import, and native PDF invoices.

## For developers

This repo is a TypeScript monorepo (React web app + API + shared domain package). Deployment and local setup live in [`DEPLOY.md`](./DEPLOY.md). Domain terms and architecture notes are in [`CONTEXT.md`](./CONTEXT.md) and [`docs/adr/`](./docs/adr/).
