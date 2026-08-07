const express=require('express');
const dotenv=require('dotenv');
const cors=require('cors');
const {MongoClient,ServerApiVersion, ObjectId}=require('mongodb');
const app=express();
dotenv.config();
const uri= process.env.MONGODB_URI
app.use(cors())
app.use(express.json())
const PORT=5000;
const client=new MongoClient(uri,{
    serverApi:{
        version:ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
})
async function run(){
    try{
          await client.connect();
          const db=client.db('petAdoption');
          const petCollection=db.collection("pets");
          app.post('/addPet',async(req,res)=>{
            const petData=req.body;
            console.log(petData);
            const result=await petCollection.insertOne(petData);
            res.json(result);
          })
          app.get('/dashboardPage',async(req,res)=>{
            const petData=await petCollection.find().toArray();
            res.json(result);
          })
           await client.db("admin").command({ping:1});
        console.log("Pigned your deployment.You successfully connected to MongoDB!")
    }finally{

    }
}
run().catch(console.dir);

app.get('/',(req,res)=>{
    res.send("Server is running fine");
})
app.listen(PORT,()=>{
    console.log(`Server is running at port ${PORT}`);
})