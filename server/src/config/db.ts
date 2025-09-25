import mongoose from 'mongoose';

import { logger } from '../utils/logger';

export async function connectDb(uri: string): Promise<void> {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (error) => logger.error('MongoDB error', error));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  logger.info(`MongoDB connected (${mongoose.connection.name})`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
