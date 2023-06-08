const express = require('express')
const cors = require('cors')
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 2007

app.use(cors());
app.use(express.json());


  const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).send({ error: "Unauthorized access!" });
    }
    const token = authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
      if (error) {
        return res.status(403).send({ error: "Unauthorized access!" });
      }
      req.decoded = decoded;
      next();
    });
  }


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fhpe21r.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("summerCampDB").collection("users");
    const classesCollection = client.db("summerCampDB").collection("classes");


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' })
      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden Access' });
      }
      next();
    }

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden Access' });
      }
      next();
    }

   // Users api

    app.get("/users/name/:email", async(req, res) => {
      const email = req.params.email;
      const query = {email : email}
      const options = {
        projection: { "storedUser.name": 1,},
      };
      const result = await usersCollection.findOne(query,options)
      res.send(result)
    })
 
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email: email }
      const options = { upsert: true }
      const updateDoc = {
        $set: {...user},
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({error:true, admin: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({error:true, instructor: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })

    app.get("/users", verifyJWT,verifyAdmin, async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result)
    })
    
    app.patch("/users/admin/:id", verifyJWT, async(req, res) => {
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    app.patch("/users/instructor/:id", verifyJWT, async(req, res) => {
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    // classes api
    app.post("/classes/add",verifyJWT,verifyInstructor, async(req, res) => {
      const classes = req.body;
      const result = classesCollection.insertOne(classes);
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




  app.get('/', (req, res) => {
    res.send('Summer Camp Server is running..')
  })
  
  app.listen(port, () => {
    console.log(`Summer Camp is running on port ${port}`)
  })