const express = require('express')
const cors = require('cors')
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)

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
    const selectOrEnrolledCollection = client.db("summerCampDB").collection("selectOrEnroleld");


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

    // users api
    app.get("/users/name/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const options = {
        projection: { "storedUser.name": 1, },
      };
      const result = await usersCollection.findOne(query, options)
      res.send(result)
    })

    app.put('/users/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email: email }
      const options = { upsert: true }
      const updateDoc = {
        $set: { ...user },
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ error: true, admin: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ error: true, instructor: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result)
    })

    app.patch("/users/admin/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    app.patch("/users/instructor/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    // classes api
    app.post("/classes/add", verifyJWT, verifyInstructor, async (req, res) => {
      const classes = req.body;
      const result = await classesCollection.insertOne(classes);
      res.send(result)
    })

    app.get("/classes/:email", verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.params.email;
      const query = { "storedClass.instructorEmail": email }
      const result = await classesCollection.find(query).toArray();
      res.send(result)
    })

    app.get("/classes", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classesCollection.find({}).toArray();
      res.send(result);
    })

    app.patch("/classes/update/:id", verifyJWT, verifyInstructor, async (req, res) => {
      const id = req.params.id;
      const classes = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { ...classes },
      }
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    app.patch("/classes/admin/approved/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          "storedClass.status": "approved",
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result)
    })

    app.patch("/classes/admin/deny/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          "storedClass.status": "deny",
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result)
    })
    
    app.patch("/classes/admin/feedback/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const feedback = req.body.giveFeedback
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback,
        },
      };
      const options = { upsert: true }
      const result = await classesCollection.updateOne(query, updateDoc, options);
      res.send(result)
    })

    app.get("/allClasses", async (req, res) => {
      const query = { "storedClass.status": "approved" }
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    })

    app.get("/classes/selected/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { selectedEmail: email, selected: true }
      const result = await selectOrEnrolledCollection.find(query).toArray();
      const result2 = await classesCollection.find().toArray();
      const selectedClass = []
      for (const selectEnrollClass of result) {
        const selecResult = result2?.filter(result => result.storedClass.className === selectEnrollClass?.className)
        if (selecResult) {
          const totalResult = { ...selecResult }
          selectedClass.push(totalResult["0"])
          for (const key in totalResult) {
            totalResult[key].selectedEmail = selectEnrollClass.selectedEmail
            totalResult[key].enrolled = selectEnrollClass.enrolled
            totalResult[key].selected = selectEnrollClass.selected
          }
        }
      }
      res.send(selectedClass)
    })

    app.get("/classes/enrolled/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { selectedEmail: email, enrolled: true }
      const result = await selectOrEnrolledCollection.find(query).toArray();
      const result2 = await classesCollection.find().toArray();
      const enrolledClass = []
      for (const selectEnrollClass of result) {
        const selecResult = result2?.filter(result => result.storedClass.className === selectEnrollClass?.className)
        if (selecResult) {
          const totalResult = { ...selecResult }
          enrolledClass.push(totalResult["0"])
          for (const key in totalResult) {
            totalResult[key].selectedEmail = selectEnrollClass.selectedEmail
            totalResult[key].enrolled = selectEnrollClass.enrolled
            totalResult[key].selected = selectEnrollClass.selected
          }
        }
      }
      res.send(enrolledClass)
    })

    app.get("/classes/payment/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classesCollection.findOne(query);
      res.send(result)
    })

    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body
      const amount = parseFloat(price) * 100
      if (!price) return
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    })

    app.patch("/classes/payments/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { ...body },
      }
      const options = { upsert: true }
      const result = await classesCollection.updateOne(query, updateDoc, options);
      res.send(result)
    })

    app.patch("/enroll/payments", verifyJWT, async (req, res) => {
      const className = req.query.className;
      const body = req.body;
      const selectedEmail = req.query.selectedEmail;
      if (className && selectedEmail) {
        const query = { className: className, selectedEmail: selectedEmail }
        const updateDoc = {
          $set: { ...body, enrolled: true, selected: false },
        }
        const options = { upsert: true }
        const result = await selectOrEnrolledCollection.updateOne(query, updateDoc, options)
        return res.send(result)
      }
      return res.send({ error: true })
    })

    app.get("/classes/payments-history/:email", verifyJWT, async (req, res) => {
      const selectedEmail = req.params.email;
      const query = { selectedEmail: selectedEmail }
      const options = {
        projection: {
          date: 1,
          transactionId: 1
        },
      };
      const result = await selectOrEnrolledCollection.find(query).sort({ date: -1 }).toArray();
      const result2 = await classesCollection.find().toArray();
      const paymentHistory = []
      for (const iterator of result) {
        if (iterator.transactionId) {
          const paymentResult = result2?.filter(result => result.storedClass.className === iterator?.className)
          if (paymentResult) {
            const totalResult = { ...paymentResult }
            paymentHistory.push(totalResult["0"])
            for (const key in totalResult) {
              totalResult[key].transactionId = iterator?.transactionId
              totalResult[key].date = iterator?.date
            }
          }
        }

      }
      res.send(paymentHistory)
    })

    app.get("/users/allInstructor", async (req, res) => {
      const query = { role: "instructor" }
      const result = await usersCollection.find(query).toArray();
      res.send(result)
    })

    app.get("/users/classes/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "storedClass.instructorEmail": email }
      const options = {
        projection: {
          storedClass: 1,
        },
      };
      const result = await classesCollection.find(query, options).toArray();
      res.send(result)
    })

    app.get("/singleInstructor/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "storedClass.instructorEmail": email, "storedClass.status": "approved" }
      const options = {
        projection: {
          storedClass: 1,
        },
      };
      const result = await classesCollection.find(query, options).toArray();
      res.send(result);
    })

    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      if (email) {
        const query = { email: email }
        const options = {
          projection: {
            role: 1,
          },
        };
        const result = await usersCollection.findOne(query, options);
        return res.send(result);
      }
      return res.send({ role: false })
    })

    app.post("/selectOrEnroll", verifyJWT, async (req, res) => {
      const body = req.body.selectedClass;
      const result = await selectOrEnrolledCollection.insertOne(body);
      res.send(result)
    })

    app.get("/selectOrEnroll", async (req, res) => {
      const className = req.query.className;
      const selectedEmail = req.query.selectedEmail;
      if (className && selectedEmail) {
        const query = { className: className, selectedEmail: selectedEmail }
        const result = await selectOrEnrolledCollection.findOne(query)
        return res.send(result)
      }
      return res.send({ error: true })
    })

    app.delete("/selectedClass/delete", verifyJWT, async (req, res) => {
      const id = req.query.id;
      const selectedEmail = req.query.selectedEmail;
      const queryWithId = { _id: new ObjectId(id) }
      const options = {
        projection: {
          "storedClass.className": 1,
        }
      }
      const findClass = await classesCollection.findOne(queryWithId, options);
      const className = findClass?.storedClass?.className;

      const queryWithSelectedEmailAndClassName = { selectedEmail: selectedEmail, className: className, enrolled: false, selected: true }
      const result = await selectOrEnrolledCollection.deleteOne(queryWithSelectedEmailAndClassName)

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