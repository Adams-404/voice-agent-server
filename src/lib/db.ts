import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'data.json');

interface Assistant {
    id: string;
    name: string;
    firstMessage: string;
    systemPrompt: string;
    voiceProvider?: string;
    voiceId?: string;
    endCallMessage?: string;
    maxDurationSeconds?: number;
    phoneNumberId?: string;
    vapiAssistantId?: string;
    createdAt: string;
}

interface PhoneNumber {
    id: string;
    name: string;
    number?: string;
    areaCode?: string;
    assistantId?: string;
    vapiPhoneNumberId?: string;
    createdAt: string;
}

interface Database {
    assistants: Assistant[];
    phoneNumbers: PhoneNumber[];
}

function readDb(): Database {
    if (!existsSync(DB_PATH)) {
        return { assistants: [], phoneNumbers: [] };
    }
    const data = readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    // Ensure phoneNumbers array exists for backwards compatibility
    return { assistants: [], phoneNumbers: [], ...parsed };
}

function writeDb(data: Database): void {
    writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export const db = {
    assistants: {
        getAll(): Assistant[] {
            return readDb().assistants;
        },

        getById(id: string): Assistant | undefined {
            return readDb().assistants.find(a => a.id === id);
        },

        create(assistant: Omit<Assistant, 'id' | 'createdAt'>): Assistant {
            const data = readDb();
            const newAssistant: Assistant = {
                ...assistant,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
            };
            data.assistants.push(newAssistant);
            writeDb(data);
            return newAssistant;
        },

        update(id: string, updates: Partial<Assistant>): Assistant | null {
            const data = readDb();
            const index = data.assistants.findIndex(a => a.id === id);
            if (index === -1) return null;
            data.assistants[index] = { ...data.assistants[index], ...updates };
            writeDb(data);
            return data.assistants[index];
        },

        delete(id: string): boolean {
            const data = readDb();
            const index = data.assistants.findIndex(a => a.id === id);
            if (index === -1) return false;
            data.assistants.splice(index, 1);
            writeDb(data);
            return true;
        },
    },

    phoneNumbers: {
        getAll(): PhoneNumber[] {
            return readDb().phoneNumbers;
        },

        getById(id: string): PhoneNumber | undefined {
            return readDb().phoneNumbers.find(p => p.id === id);
        },

        create(phoneNumber: Omit<PhoneNumber, 'id' | 'createdAt'>): PhoneNumber {
            const data = readDb();
            const newPhoneNumber: PhoneNumber = {
                ...phoneNumber,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
            };
            data.phoneNumbers.push(newPhoneNumber);
            writeDb(data);
            return newPhoneNumber;
        },

        update(id: string, updates: Partial<PhoneNumber>): PhoneNumber | null {
            const data = readDb();
            const index = data.phoneNumbers.findIndex(p => p.id === id);
            if (index === -1) return null;
            data.phoneNumbers[index] = { ...data.phoneNumbers[index], ...updates };
            writeDb(data);
            return data.phoneNumbers[index];
        },

        delete(id: string): boolean {
            const data = readDb();
            const index = data.phoneNumbers.findIndex(p => p.id === id);
            if (index === -1) return false;
            data.phoneNumbers.splice(index, 1);
            writeDb(data);
            return true;
        },
    },
};

