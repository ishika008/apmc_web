import mongoose from 'mongoose';
const CounterSchema=new mongoose.Schema({_id:String,value:{type:Number,default:0}},{versionKey:false});
export default mongoose.models.Counter||mongoose.model('Counter',CounterSchema);
