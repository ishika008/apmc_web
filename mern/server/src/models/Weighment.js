import mongoose from 'mongoose';
const o={timestamps:true};
const WeighmentSchema=new mongoose.Schema({lot:{type:mongoose.Schema.Types.ObjectId,ref:'Lot',required:true,index:true},gross:{type:Number,required:true,min:0.001},tare:{type:Number,required:true,min:0},net:{type:Number,required:true,min:0.001},scaleId:String,slipRef:String,notes:String,recordedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},correctionOf:{type:mongoose.Schema.Types.ObjectId,ref:'Weighment',default:null},correctionReason:String},o);
export default mongoose.models.Weighment||mongoose.model('Weighment',WeighmentSchema);
