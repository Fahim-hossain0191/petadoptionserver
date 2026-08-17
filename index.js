const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
dotenv.config();
const uri = process.env.MONGODB_URI
app.use(cors())
app.use(express.json())
const PORT = 5000;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
})
const JWKS=createRemoteJWKSet(
    new URL('http://localhost:3000/api/auth/jwks')
)

const verifyToken=async(req,res,next)=>{
const authHeader=req?.headers.authorization
if(!authHeader){
    return res.status(401).json({message:"Unauthorized"})
}
const token=authHeader.split(" ")[1]
if(!token){
    return res.status(401).json({message:"Unauthorized"})
}
try{

    const {payload}=await jwtVerify(token,JWKS)
    console.log(payload)
   next()
}catch(error){
    console.log(error);
}

}
async function run() {
    try {
        await client.connect();
        const db = client.db('petAdoption');
        const petCollection = db.collection("pets");
        const adoptionCollection = db.collection("adoptions")
        app.post('/addPet', async (req, res) => {
            const petData = req.body;
            console.log(petData);
            const result = await petCollection.insertOne(petData);
            res.json(result);
        })
        app.get('/allPetPage', async (req, res) => {
            const petData = await petCollection.find().toArray();
            res.json(petData);
        })
        app.get('/allPetPage/:id', verifyToken,async (req, res) => {
            const header=req.headers.authorization
            console.log(header)
            const { id } = req.params
            const result = await petCollection.findOne({ _id: new ObjectId(id) })
            res.json(result);
        })
        app.post("/adoption-requests", async (req, res) => {
            const bookingData = req.body;
            const result = await adoptionCollection.insertOne(bookingData)
            res.json(result);
        })
        app.get("/adoption-requests", async (req, res) => {
            try {
                const { email, petId } = req.query;

                let query = {};

                if (email) {
                    query.ownerEmail = email;
                }

                if (petId) {
                    query.petId = petId;
                }

                const requests = await adoptionCollection
                    .find(query)
                    .sort({ _id: -1 })
                    .toArray();

                res.json(requests);

            } catch (error) {
                console.error(error);

                res.status(500).json({
                    message: "Failed to fetch adoption requests",
                });
            }
        });
        app.get("/my-listings/:email", async (req, res) => {
            try {
                const email = req.params.email;

                console.log("Fetching listings for:", email);

                const pets = await petCollection
                    .find({ ownerEmail: email })
                    .sort({ _id: -1 })
                    .toArray();

                console.log("Found pets:", pets.length);

                res.json(pets);
            } catch (error) {
                console.error("My listings error:", error);

                res.status(500).json({
                    message: "Failed to fetch listings",
                    error: error.message,
                });
            }
        });
        // app.patch("/adoption-requests/:id", async (req, res) => {
        //     try {
        //         const { id } = req.params;
        //         const { status } = req.body;

        //         if (!["approved", "rejected"].includes(status)) {
        //             return res.status(400).json({
        //                 message: "Invalid status",
        //             });
        //         }

        //         const request = await adoptionCollection.findOne({
        //             _id: new ObjectId(id),
        //         });

        //         if (!request) {
        //             return res.status(404).json({
        //                 message: "Adoption request not found",
        //             });
        //         }

        //         // If rejecting, simply reject this request
        //         if (status === "rejected") {
        //             await adoptionCollection.updateOne(
        //                 { _id: new ObjectId(id) },
        //                 {
        //                     $set: {
        //                         status: "rejected",
        //                     },
        //                 }
        //             );

        //             return res.json({
        //                 success: true,
        //                 message: "Request rejected",
        //             });
        //         }

        //         // ============================
        //         // APPROVING REQUEST
        //         // ============================

        //         // Find the pet
        //         const pet = await petCollection.findOne({
        //             _id: new ObjectId(request.petId),
        //         });

        //         if (!pet) {
        //             return res.status(404).json({
        //                 message: "Pet not found",
        //             });
        //         }

        //         // Already adopted?
        //         if (pet.status === "adopted") {
        //             return res.status(400).json({
        //                 message: "This pet has already been adopted",
        //             });
        //         }

        //         // Approve selected request
        //         await adoptionCollection.updateOne(
        //             { _id: new ObjectId(id) },
        //             {
        //                 $set: {
        //                     status: "approved",
        //                 },
        //             }
        //         );

        //         // Reject all other requests for this pet
        //         await adoptionCollection.updateMany(
        //             {
        //                 petId: request.petId,
        //                 _id: { $ne: new ObjectId(id) },
        //                 status: "pending",
        //             },
        //             {
        //                 $set: {
        //                     status: "rejected",
        //                 },
        //             }
        //         );

        //         // Mark pet as adopted
        //         await petCollection.updateOne(
        //             {
        //                 _id: new ObjectId(request.petId),
        //             },
        //             {
        //                 $set: {
        //                     status: "adopted",
        //                 },
        //             }
        //         );

        //         res.json({
        //             success: true,
        //             message: "Request approved and pet marked as adopted",
        //         });

        //     } catch (error) {
        //         console.error("Approval error:", error);

        //         res.status(500).json({
        //             message: "Failed to process adoption request",
        //         });
        //     }
        // })
        // ;
        app.patch("/adoption-requests/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;

                if (!["approved", "rejected"].includes(status)) {
                    return res.status(400).json({
                        message: "Invalid status",
                    });
                }

                const request = await adoptionCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!request) {
                    return res.status(404).json({
                        message: "Adoption request not found",
                    });
                }

                // If rejecting, simply reject this request
                if (status === "rejected") {
                    await adoptionCollection.updateOne(
                        { _id: new ObjectId(id) },
                        {
                            $set: {
                                status: "rejected",
                            },
                        }
                    );

                    return res.json({
                        success: true,
                        message: "Request rejected",
                    });
                }

                // ============================
                // APPROVING REQUEST
                // ============================

                // Find the pet
                const pet = await petCollection.findOne({
                    _id: new ObjectId(request.petId),
                });

                if (!pet) {
                    return res.status(404).json({
                        message: "Pet not found",
                    });
                }

                // Already adopted?
                if (pet.status === "adopted") {
                    return res.status(400).json({
                        message: "This pet has already been adopted",
                    });
                }

                // Approve selected request
                await adoptionCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status: "approved",
                        },
                    }
                );

                // Reject all other requests for this pet
                await adoptionCollection.updateMany(
                    {
                        petId: request.petId,
                        _id: { $ne: new ObjectId(id) },
                        status: "pending",
                    },
                    {
                        $set: {
                            status: "rejected",
                        },
                    }
                );

                // Mark pet as adopted
                await petCollection.updateOne(
                    {
                        _id: new ObjectId(request.petId),
                    },
                    {
                        $set: {
                            status: "adopted",
                        },
                    }
                );

                res.json({
                    success: true,
                    message: "Request approved and pet marked as adopted",
                });

            } catch (error) {
                console.error("Approval error:", error);

                res.status(500).json({
                    message: "Failed to process adoption request",
                });
            }
        });
        await client.db("admin").command({ ping: 1 });
        console.log("Pigned your deployment.You successfully connected to MongoDB!")
    } finally {

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send("Server is running fine");
})
app.listen(PORT, () => {
    console.log(`Server is running at port ${PORT}`);
})