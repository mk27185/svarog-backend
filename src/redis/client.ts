import "dotenv/config";
import { createRedis } from "../config/connection.js";

export const redis = createRedis();
