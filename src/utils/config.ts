// src/config.ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: process.env.PORT || 3000,
    // Add other configuration settings here
};