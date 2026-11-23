import { Counter } from '../models/index.js';

export const nextNumber = async key => {
  const row = await Counter.findOneAndUpdate({ _id: key }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  return row.value;
};
