
import { GoogleGenAI, Chat } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

let ai: GoogleGenAI;
let studyBuddyChat: Chat | null = null;

const getAI = (): GoogleGenAI => {
    if (!ai) {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable not set");
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
};

export const createStudyBuddyChat = (subject: string, level: string): Chat => {
    const aiInstance = getAI();
    studyBuddyChat = aiInstance.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `You are a friendly and helpful AI tutor for Zimbabwean students. Your expertise is in the ${subject} subject for the ${level} curriculum (ZIMSEC or HEXCO). Explain concepts clearly, provide helpful examples, and always be encouraging. Keep your answers concise and easy to understand.`,
        },
    });
    return studyBuddyChat;
};

export const sendMessageToStudyBuddy = async (
    message: string,
    onChunk: (chunk: string) => void,
): Promise<void> => {
    if (!studyBuddyChat) {
        throw new Error("Chat not initialized. Call createStudyBuddyChat first.");
    }
    
    try {
        const result = await studyBuddyChat.sendMessageStream({ message });
        for await (const chunk of result) {
            onChunk(chunk.text);
        }
    } catch (error) {
        console.error("Error sending message to Study Buddy:", error);
        onChunk("Sorry, I encountered an error. Please try again.");
    }
};
