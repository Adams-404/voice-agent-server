import express from 'express';
import { db } from './lib/db';
import { vapi } from './lib/vapi';

const getDefaultSystemPrompt = (name: string) =>
    `You are ${name}, a real human personal assistant. Never call yourself an AI, bot, or virtual assistant. Speak casually, warmly, and with a sense of humor. Be curious and conversational—ask natural follow-up questions and react like a friend who genuinely cares. Keep answers practical and concise, but not terse; add a light joke or playful remark when it fits. Avoid canned phrases and corporate tone. If you do not know something, say so and think it through out loud. Your goal: help, collaborate, and make the conversation feel like it is with a real person.`;

const app = express();
app.use(express.json());

app.get('/', (_, res) => {
    res.send('Hello World');
});

// ==================== Assistants ==================== //

app.route("/assistants")
    .get((_, res) => {
        try {
            const assistants = db.assistants.getAll();
            res.send({ assistants });
        } catch (error) {
            res.status(500).send({ error: "Failed to get assistants" });
        }
    })
    .post(async (req, res) => {
        const { name, firstMessage, systemPrompt } = req.body;

        if (!name || !firstMessage) {
            return res.status(400).send({ error: "name and firstMessage are required" });
        }

        try {
            // Create in Vapi
            const vapiAssistant = await vapi.assistants.create({
                name,
                firstMessage,
                model: {
                    provider: "openai",
                    model: "chatgpt-4o-latest",
                    messages: [
                        { role: "system", content: systemPrompt || getDefaultSystemPrompt(name) },
                    ],
                },
                voice: {
                    provider: "11labs",
                    voiceId: "DwwuoY7Uz8AP8zrY5TAo",
                },
                endCallMessage: "Thank you for calling. Goodbye!",
                maxDurationSeconds: 300,
            });

            // Store in local JSON db
            const assistant = db.assistants.create({
                name,
                firstMessage,
                systemPrompt: systemPrompt || getDefaultSystemPrompt(name),
                vapiAssistantId: vapiAssistant.id,
            });

            res.send(assistant);
        } catch (error) {
            console.error("Failed to create assistant:", error);
            res.status(500).send({ error: "Failed to create assistant", details: String(error) });
        }
    })
    .patch(async (req, res) => {
        const {
            id,
            name,
            firstMessage,
            systemPrompt,
            voiceProvider,
            voiceId,
            endCallMessage,
            maxDurationSeconds,
            phoneNumberId,
        } = req.body;

        if (!id) {
            return res.status(400).send({ error: "id is required" });
        }

        try {
            const assistant = db.assistants.getById(id);
            if (!assistant || !assistant.vapiAssistantId) {
                return res.status(404).send({ error: "Assistant not found" });
            }

            // Build voice config if provided
            const voice = voiceProvider && voiceId
                ? { provider: voiceProvider, voiceId }
                : undefined;

            // Update in Vapi
            await vapi.assistants.update({
                id: assistant.vapiAssistantId,
                ...(name && { name }),
                ...(firstMessage && { firstMessage }),
                ...(systemPrompt && {
                    model: {
                        provider: "openai",
                        model: "chatgpt-4o-latest",
                        messages: [{ role: "system", content: systemPrompt }],
                    },
                }),
                ...(voice && { voice }),
                ...(endCallMessage && { endCallMessage }),
                ...(maxDurationSeconds && { maxDurationSeconds }),
            });

            // If phoneNumberId provided, link the phone number to this assistant in Vapi
            if (phoneNumberId) {
                const phoneNumber = db.phoneNumbers.getById(phoneNumberId);
                if (phoneNumber && phoneNumber.vapiPhoneNumberId) {
                    await vapi.phoneNumbers.update({
                        id: phoneNumber.vapiPhoneNumberId,
                        body: {
                            assistantId: assistant.vapiAssistantId,
                        },
                    });
                    // Update phone number's local record too
                    db.phoneNumbers.update(phoneNumberId, { assistantId: id });
                }
            }

            // Update local db
            const updated = db.assistants.update(id, {
                ...(name && { name }),
                ...(firstMessage && { firstMessage }),
                ...(systemPrompt && { systemPrompt }),
                ...(voiceProvider && { voiceProvider }),
                ...(voiceId && { voiceId }),
                ...(endCallMessage && { endCallMessage }),
                ...(maxDurationSeconds && { maxDurationSeconds }),
                ...(phoneNumberId && { phoneNumberId }),
            });

            res.send(updated);
        } catch (error) {
            console.error("Failed to update assistant:", error);
            const vapiError = error as { body?: { message?: string }; statusCode?: number };
            const errorMessage = vapiError?.body?.message || String(error);
            const statusCode = vapiError?.statusCode || 500;
            res.status(statusCode).send({ error: errorMessage });
        }
    })
    .delete(async (req, res) => {
        const { id } = req.body;

        if (!id) {
            return res.status(400).send({ error: "id is required" });
        }

        try {
            // Get assistant to find Vapi ID
            const assistant = db.assistants.getById(id);
            if (!assistant) {
                return res.status(404).send({ error: "Assistant not found" });
            }

            // Delete from Vapi if it exists there
            if (assistant.vapiAssistantId) {
                await vapi.assistants.delete({ id: assistant.vapiAssistantId });
            }

            // Delete from local db
            db.assistants.delete(id);
            res.send({ message: "Assistant deleted successfully" });
        } catch (error) {
            console.error("Failed to delete assistant:", error);
            res.status(500).send({ error: "Failed to delete assistant", details: String(error) });
        }
    })

app.route("/assistants/:id")
    .get(async (req, res) => {
        const { id } = req.params;
        console.log("id", id);
        const assistant = db.assistants.getById(id as string);
        if (!assistant) {
            return res.status(404).send({ error: "Assistant not found" });
        }
        try {
            const vapiAssistant = await vapi.assistants.get({ id: assistant.vapiAssistantId as string });
            if (!vapiAssistant) {
                return res.status(404).send({ error: "Vapi Assistant not found" });
            }
            res.send({ ...assistant, vapiAssistant });
        } catch (error) {
            console.error("Failed to get assistant:", error);
            res.status(500).send({ error: "Failed to get assistant", details: String(error) });
        }
    });

// ==================== Phone Numbers ==================== //

app.route("/phone-numbers")
    .get((_, res) => {
        try {
            const phoneNumbers = db.phoneNumbers.getAll();
            res.send({ phoneNumbers });
        } catch (error) {
            console.error("Failed to list phone numbers:", error);
            res.status(500).send({ error: "Failed to list phone numbers" });
        }
    })
    .post(async (req, res) => {
        const { name, assistantId } = req.body;

        if (!name) {
            return res.status(400).send({ error: "name is required" });
        }

        try {
            // If assistantId is provided, look up the Vapi assistant ID
            let vapiAssistantId: string | undefined;
            if (assistantId) {
                const assistant = db.assistants.getById(assistantId);
                if (!assistant || !assistant.vapiAssistantId) {
                    return res.status(400).send({ error: "Assistant not found or not synced with Vapi" });
                }
                vapiAssistantId = assistant.vapiAssistantId;
            }

            // Create in Vapi with hardcoded area code 207
            const vapiPhoneNumber = await vapi.phoneNumbers.create({
                provider: "vapi",
                name,
                numberDesiredAreaCode: "207",
                ...(vapiAssistantId && { assistantId: vapiAssistantId }),
            });

            console.log("Vapi phone number created:", vapiPhoneNumber);

            // Store in local JSON db
            const phoneNumber = db.phoneNumbers.create({
                name,
                number: vapiPhoneNumber.number,
                areaCode: "207",
                assistantId,
                vapiPhoneNumberId: vapiPhoneNumber.id,
            });

            res.send(phoneNumber);
        } catch (error) {
            console.error("Failed to create phone number:", error);
            const vapiError = error as { body?: { message?: string }; statusCode?: number };
            const errorMessage = vapiError?.body?.message || String(error);
            const statusCode = vapiError?.statusCode || 500;
            res.status(statusCode).send({ error: errorMessage });
        }
    })
    .patch(async (req, res) => {
        const { id, assistantId } = req.body;

        if (!id) {
            return res.status(400).send({ error: "id is required" });
        }

        try {
            const phoneNumber = db.phoneNumbers.getById(id);
            if (!phoneNumber) {
                return res.status(404).send({ error: "Phone number not found" });
            }

            // If assistantId is provided, look up the Vapi assistant ID
            let vapiAssistantId: string | undefined;
            if (assistantId) {
                const assistant = db.assistants.getById(assistantId);
                if (!assistant || !assistant.vapiAssistantId) {
                    return res.status(400).send({ error: "Assistant not found or not synced with Vapi" });
                }
                vapiAssistantId = assistant.vapiAssistantId;
            }

            // Update in Vapi
            if (phoneNumber.vapiPhoneNumberId) {
                await vapi.phoneNumbers.update({
                    id: phoneNumber.vapiPhoneNumberId,
                    body: {
                        assistantId: vapiAssistantId,
                    },
                });
            }

            // Update in local db
            const updated = db.phoneNumbers.update(id, { assistantId });
            res.send(updated);
        } catch (error) {
            console.error("Failed to update phone number:", error);
            const vapiError = error as { body?: { message?: string }; statusCode?: number };
            const errorMessage = vapiError?.body?.message || String(error);
            const statusCode = vapiError?.statusCode || 500;
            res.status(statusCode).send({ error: errorMessage });
        }
    })
    .delete(async (req, res) => {
        const { id } = req.body;

        if (!id) {
            return res.status(400).send({ error: "id is required" });
        }

        try {
            const phoneNumber = db.phoneNumbers.getById(id);
            if (!phoneNumber) {
                return res.status(404).send({ error: "Phone number not found" });
            }

            // Delete from Vapi
            if (phoneNumber.vapiPhoneNumberId) {
                await vapi.phoneNumbers.delete({ id: phoneNumber.vapiPhoneNumberId });
            }

            // Delete from local db
            db.phoneNumbers.delete(id);
            res.send({ success: true, message: "Phone number deleted" });
        } catch (error) {
            console.error("Failed to delete phone number:", error);
            res.status(500).send({ error: String(error) });
        }
    });

app.route("/phone-numbers/:id")
    .get(async (req, res) => {
        const { id } = req.params;

        const phoneNumber = db.phoneNumbers.getById(id);
        if (!phoneNumber) {
            return res.status(404).send({ error: "Phone number not found" });
        }

        try {
            let vapiPhoneNumber = null;
            if (phoneNumber.vapiPhoneNumberId) {
                vapiPhoneNumber = await vapi.phoneNumbers.get({ id: phoneNumber.vapiPhoneNumberId });
            }
            res.send({ ...phoneNumber, vapiPhoneNumber });
        } catch (error) {
            console.error("Failed to get phone number:", error);
            res.status(500).send({ error: "Failed to get phone number", details: String(error) });
        }
    });

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});