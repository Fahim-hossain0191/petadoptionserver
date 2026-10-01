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
    new URL((`${process.env.CLIENT_URL}/api/auth/jwks`))
)

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    try {
        const { payload } = await jwtVerify(token, JWKS);

        req.user = payload;

        next();

    } catch (error) {

        console.error("JWT Verify Error:", error);

        return res.status(401).json({
            message: "Invalid token",
            error: error.code
        });
    }
};

async function run() {
    try {
        // await client.connect();
        const db = client.db('petAdoption');
        const petCollection = db.collection("pets");
        const adoptionCollection = db.collection("adoptions")
       app.post('/addPet', verifyToken, async (req, res) => {
    try {
        const petData = req.body;

        const userEmail = req.user.email;

        if (!userEmail) {
            return res.status(401).json({
                message: "User email not found in token",
            });
        }

        const newPet = {
            ...petData,
            ownerEmail: userEmail,
        };

        const result = await petCollection.insertOne(newPet);

        res.json(result);

    } catch (error) {
        console.error("Add pet error:", error);

        res.status(500).json({
            message: "Failed to add pet",
        });
    }
});
        app.get('/allPetPage',verifyToken, async (req, res) => {
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
        app.post("/adoption-requests", verifyToken,async (req, res) => {
            const bookingData = req.body;
            const result = await adoptionCollection.insertOne(bookingData)
            res.json(result);
        })

//      app.get("/adoption-requests", verifyToken, async (req, res) => {
//   try {
//     const userEmail = req.user.email;
//     const { petId } = req.query;

//     if (!userEmail) {
//       return res.status(401).json({
//         message: "User email not found in token",
//       });
//     }

//     let query;

//     // Used by PetCard / pet details:
//     // Get requests made BY the logged-in user for a specific pet
//     if (petId) {
//       query = {
//         petId: petId,
//         userEmail: userEmail,
//       };
//     } 
//     // Used by MyRequests:
//     // Get requests FOR pets owned by the logged-in user
//     else {
//       query = {
//         ownerEmail: userEmail,
//       };
//     }

//     const requests = await adoptionCollection
//       .find(query)
//       .sort({ _id: -1 })
//       .toArray();

//     res.json(requests);
//   } catch (error) {
//     console.error("Fetch adoption requests error:", error);

//     res.status(500).json({
//       message: "Failed to fetch adoption requests",
//     });
//   }
// });
app.get("/adoption-requests", verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { petId } = req.query;

    if (!userEmail) {
      return res.status(401).json({
        message: "User email not found in token",
      });
    }

    // --------------------------------------------------
    // If petId is provided:
    // Get requests made BY the logged-in user for this pet
    // --------------------------------------------------
    if (petId) {
      const requests = await adoptionCollection
        .find({
          petId: petId,
          userEmail: userEmail,
        })
        .sort({ _id: -1 })
        .toArray();

      return res.json(requests);
    }

    // --------------------------------------------------
    // My Requests:
    // Find pets owned by the logged-in user
    // --------------------------------------------------
    const myPets = await petCollection
      .find({
        ownerEmail: userEmail,
      })
      .toArray();

    const myPetIds = myPets.map((pet) => pet._id.toString());

    console.log("Logged-in user:", userEmail);
    console.log("My pet IDs:", myPetIds);

    if (myPetIds.length === 0) {
      return res.json([]);
    }

    // --------------------------------------------------
    // Find adoption requests for those pets
    // --------------------------------------------------
    const requests = await adoptionCollection
      .find({
        petId: { $in: myPetIds },
      })
      .sort({ _id: -1 })
      .toArray();

    res.json(requests);

  } catch (error) {
    console.error("Fetch adoption requests error:", error);

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
        app.patch("/adoption-requests/:id", verifyToken,async (req, res) => {
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
        // await client.db("admin").command({ ping: 1 });
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