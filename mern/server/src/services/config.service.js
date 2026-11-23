import { YardConfig } from '../models/index.js';

export const getYardConfig = async () => YardConfig.findOneAndUpdate({ key: 'yard' }, { $setOnInsert: { key: 'yard' } }, { new: true, upsert: true, setDefaultsOnInsert: true });
