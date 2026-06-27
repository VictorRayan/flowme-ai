# Flow Me LP Implementation Plan

Last updated: 2026-06-27

## Goal

Create a separate landing page application for the root domain `flow-me.online`, deployed on the same production server as the app, behind Traefik.

The web app remains on `app.flow-me.online`. The LP sends qualified traffic to the app checkout.

## Deployment Shape

- `flowme-lp/`: separate static landing page application.
- `flowme-lp/Dockerfile`: Nginx image serving static files.
- `flowme-app/`: existing authenticated app and checkout.
- Traefik routes:
  - `flow-me.online` -> `flowme-lp`
  - `app.flow-me.online` -> `flowme-app`

## Copy Strategy

Use short and direct sentences. Keep the reading level simple. Favor concrete verbs and plain words.

Flesch-Kincaid direction:

- Short sentences.
- Clear sections.
- One idea per paragraph.
- Avoid jargon unless it is a known promise: "Jarvis pessoal".
- Use product outcomes before feature names.

## LP Structure

1. Hero
   - Promise: "Seu Jarvis pessoal para executar o que importa."
   - CTA to checkout.
   - Secondary CTA to app login.

2. Problem
   - Work, life, Slack, Gmail, WhatsApp, tasks, calendar and reminders are scattered.

3. Features
   - Priorities.
   - Calendar and Today.
   - Slack and Gmail context.
   - WhatsApp reminders.
   - Checklists and audio.
   - Finance and reviews.

4. Future / Coming Soon
   - iOS and Android app at no extra cost for current buyers.
   - WhatsApp filtering.
   - Telegram connection.
   - Microsoft Teams connection.

5. Testimonials
   - Victor Rayan.
   - Leticia Goncalves dos Santos.
   - Gabriel Nogueira.

6. Final CTA
   - Direct checkout link.

## Checkout

Primary checkout target:

```txt
https://app.flow-me.online/checkout
```

If the user is not authenticated, the app should handle login and return to checkout.

## Validation

- Static page renders locally.
- Docker image builds.
- Compose config validates.
- Production CI builds/publishes `flowme-lp` image.
