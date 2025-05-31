import express, { Request, Response } from "express"
import cors from "cors"
import dotenv from "dotenv"
import { StreamChat } from "stream-chat"
import OpenAI from "openai"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { db } from "./config/database.js"
import { chats, users } from "./db/schema.js"
import { eq } from "drizzle-orm"
import { ChatCompletionMessageParam } from "openai/resources"

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

// Initialize Stream Chat client
const chatClient = StreamChat.getInstance(
    process.env.STREAM_API_KEY!,
    process.env.STREAM_SECRET_KEY!
)

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

// Initialize Google GenAI client
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

//register user with stream chat
app.post("/register-user", async (req: Request, res: Response): Promise<any> => {

    const { name, email } = req.body || {}
    if (!name || !email) {
        return res.status(400).json({ error: "Name and email are required" })
    }

    try {
        const userId = email.replace(/[^a-zA-Z0-9_-]/g, "_")
        // Check if the user already exists
        const userResponse = await chatClient.queryUsers({ id: { $eq: userId } });

        console.log("User response:", userResponse)

        if (!userResponse.users.length) {
            await chatClient.upsertUser({
                id: userId,
                name: name,
                role: "user",
                ...{ email }
            })
        }

        //check if user exists in the database
        const existinguser = await db.select().from(users).where(eq(users.userId, userId));

        if (!existinguser.length) {
            console.log("User not found in the database, inserting new user")
            // Insert user into the database
            await db.insert(users).values({ userId, name, email })
        }

        res.status(200).json({ userId, name, email })
    }
    catch (error) {
        res.status(500).json({ error: "Failed to register user" })
    }
})

//Send Message to AI
app.post("/chat", async (req: Request, res: Response): Promise<any> => {
    const { userId, message } = req.body || {}

    if (!userId || !message) {
        return res.status(400).json({ error: "User ID and message are required" })
    }

    // check if userId is valid
    const existinguser = await db.select().from(users).where(eq(users.userId, userId));

    if (!existinguser.length) {
        return res.status(404).json({ error: "User not found in the database" })
    }

    try {
        //verify user exists
        const userResponse = await chatClient.queryUsers({ id: userId });
        if (!userResponse.users.length) {
            return res.status(404).json({ error: "User not found" })
        }
        // Send message to OpenAI (to get the response from OpenAI you need to pay for the API)
        // const completion = openai.chat.completions.create({
        //     model: "gpt-4o-mini",
        //     messages: [
        //         { role: "system", content: message }],
        // });

        // If you want to use Google GenAI instead, you can uncomment the following lines
        const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" })
        const question = await model.generateContent(message)
        const resultFromGenAI: string = (await question.response.text()) ?? "No response from AI"

        await db.insert(chats).values({ userId, message, reply: resultFromGenAI })

        // Create or update the chat channel
        const channel = chatClient.channel('messaging', `chat-${userId}`, {
            name: 'AI Chat',
            created_by_id: 'ai_bot'
        })
        await channel.create()
        await channel.sendMessage({
            text: resultFromGenAI,
            user_id: 'ai_bot',
        })

        res.status(200).json({ reply: resultFromGenAI })
    } catch (error) {
        return res.status(500).json({ error: "Failed to process chat message" })
    }
})

app.post("/get-messages", async (req: Request, res: Response): Promise<any> => {

    const { userId } = req.body

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" })
    }

    try {
        // Check if user exists in the database
        const existinguser = await db.select().from(users).where(eq(users.userId, userId));
        if (!existinguser.length) {
            return res.status(404).json({ error: "User not found in the database" })
        }
        // Verify user exists in Stream Chat
        const chatHistory = await db.select().from(chats).where(eq(chats.userId, userId))
        res.status(200).json({ messages: chatHistory })
    } catch (error) {
        return res.status(500).json({ error: "Failed to get messages" })
    }
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})