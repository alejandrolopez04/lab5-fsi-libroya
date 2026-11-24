import { Schema, model } from 'mongoose';

export const ROLES = ['cliente', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true, default: 'cliente' },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
