# MERN Shop 🛒

A production-grade e-commerce platform built with the MERN stack, Redis, Stripe, and real-time chat.

## Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, Redux Toolkit
- **Backend:** Node 20, Express 5, TypeScript, MongoDB, Mongoose 8
- **Cache / Queue:** Redis (ioredis), BullMQ
- **Auth:** JWT (access + refresh), Passport (Google/Discord/Facebook), TOTP 2FA
- **Realtime:** Socket.IO with Redis adapter
- **Payments:** Stripe
- **Email:** Resend
- **Testing:** Vitest, Supertest

## Requirements

- Node ≥ 20.11.0
- npm ≥ 10
- MongoDB (local or Atlas)
- Redis (local or Upstash/Redis Cloud)

## Getting Started

```bash
# 1. Clone
git clone <your-repo-url> mern-shop
cd mern-shop

# 2. Use correct Node version
nvm use        # reads .nvmrc

# 3. Install all workspaces
npm install

# 4. Copy env template (added in a future commit)
# cp server/.env.example server/.env
# cp client/.env.example client/.env

# 5. Run dev servers
npm run dev
```

## Project Structure

```
mern-shop/
├── client/     React 19 + Vite + Tailwind frontend
├── server/     Express 5 API
└── shared/     Zod schemas + TS types shared by both
```

## License

MIT