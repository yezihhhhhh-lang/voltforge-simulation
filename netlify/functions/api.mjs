import worker from "../../dist/server/index.js";
import { DB } from "../database/adapter.mjs";

export default async request => worker.fetch(request, {
  DB,
  INVITE_CODE: process.env.INVITE_CODE,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SESSION_SECRET: process.env.SESSION_SECRET,
});

export const config = {
  path: "/api/*",
};

