import dotenv from 'dotenv';
dotenv.config();
import { VapiClient } from "@vapi-ai/server-sdk";

export const vapi = new VapiClient({ token: process.env.VAPI_API_KEY! });
