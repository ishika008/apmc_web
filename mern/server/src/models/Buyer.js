import mongoose from 'mongoose';
const o={timestamps:true};
const BuyerSchema=new mongoose.Schema({name:{type:String,required:true,trim:true,unique:true},registrationNo:{type:String,required:true,trim:true},creditDays:{type:Number,default:5,min:0,max:90},purchaseLimit:{type:Number,default:0,min:0},active:{type:Boolean,default:true},notes:{type:String,trim:true,maxlength:1000}},o);
export default mongoose.models.Buyer||mongoose.model('Buyer',BuyerSchema);
