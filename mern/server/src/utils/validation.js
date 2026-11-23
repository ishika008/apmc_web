import mongoose from 'mongoose';
// Mongoose treats numbers as castable ObjectIds; API ids are always 24-char hex strings.
export const isId = value => typeof value !== 'number' && mongoose.isValidObjectId(value);
export const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
