import { auth } from "../auth";
import type { Context } from "hono";

export const handleAuth = (c: Context) => {
  // You can fetch the requestId if you want to attach it to downstream logs
  // const requestId = c.get("requestId");
  return auth.handler(c.req.raw);
};
