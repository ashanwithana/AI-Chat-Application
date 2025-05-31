import express from "express"
import cors from "cors"
import dotenv from "dotenv"

// Load environment variables from .env file
dotenv.config()

// Create an Express application
const app = express()

// Configure CORS to allow requests from any origin
app.use(cors())

// Middleware to parse JSON bodies
app.use(express.json())

// urlencoded middleware to parse URL-encoded bodies
app.use(express.urlencoded({ extended: false }))

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})